package sim

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
)

const TICK_DURATION = time.Millisecond * 100 // 10 ticks per second

var currentSceneId int64 = -1

func nextSceneId() int64 {
	currentSceneId += 1
	return currentSceneId
}

/*
SpaceSimulator holds all of the state for a space and can step the simulation forward through "time"
It does not handle any of the communication with clients. That's the job of the SimHostServer and the WS service.
*/
type SpaceSimulator struct {
	Running           bool                  // True if the simulator should be automatically ticking
	Frame             int64                 // The current frame number
	Name              string                // The Name of the SpaceRecord
	UUID              string                // The UUID of the SpaceRecord
	RootNode          *SceneNode            // The scene graph, including SceneNodes for avatars
	Clients           map[string]*SceneNode // <clientUUID, avatar node (may be nil for avatar-less clients)>
	Additions         []*SceneAddition      // Nodes added to the scene since the last tick
	Deletions         []int64               // Node IDs removed from the scene since the last tick
	DefaultAvatarUUID string
	SimHostServer     *SimHostServer
	DBInfo            *be.DBInfo

	ClientMembershipChannel chan *ClientMembershipNotice
	AvatarMotionChannel     chan *AvatarMotionNotice
	NodeUpdateChannel       chan *NodeUpdateNotice
}

func NewSpaceSimulator(spaceUUID string, simHostServer *SimHostServer, dbInfo *be.DBInfo) (*SpaceSimulator, error) {
	spaceRecord, err := apiDB.FindSpaceRecord(spaceUUID, dbInfo)
	if err != nil {
		return nil, err
	}
	state, err := spaceRecord.DecodeState()
	if err != nil {
		return nil, err
	}
	avatarRecord, err := apiDB.FindAvatarRecord(spaceRecord.Avatar, dbInfo)
	if err != nil {
		logger.Println("Error searching for avatar record ", spaceRecord.Avatar, " for space", spaceRecord.UUID, err)
		return nil, err
	}
	rootNode, err := NewRootNode(state, dbInfo)
	if err != nil {
		return nil, err
	}
	rootNode.SetClean(true)

	return &SpaceSimulator{
		Running:           false,
		Frame:             0,
		Name:              spaceRecord.Name,
		UUID:              spaceUUID,
		RootNode:          rootNode,
		Clients:           make(map[string]*SceneNode),
		Additions:         []*SceneAddition{},
		Deletions:         []int64{},
		DefaultAvatarUUID: avatarRecord.UUID,
		SimHostServer:     simHostServer,
		DBInfo:            dbInfo,

		ClientMembershipChannel: make(chan *ClientMembershipNotice, 1024),
		AvatarMotionChannel:     make(chan *AvatarMotionNotice, 1024),
		NodeUpdateChannel:       make(chan *NodeUpdateNotice, 1024),
	}, nil
}

/*
StartTime starts a go routine that loops until SpaceSimulator.Running is false, ticking every TICK_DURATION
*/
func (spaceSim *SpaceSimulator) StartTime() {
	if spaceSim.Running {
		return
	}
	spaceSim.Running = true
	spaceSim.RootNode.SetClean(true)
	go func() {
		for spaceSim.Running == true {
			t := time.Now().UnixNano()
			spaceSim.Tick(TICK_DURATION)
			time.Sleep(TICK_DURATION - (time.Duration(time.Now().UnixNano()-t) * time.Nanosecond))
		}
	}()
}

/*
Tick is where the SpaceSimulator actually simulates time passing by:
- reading all of the channels (addition, deletion, membership, avatar motion) and updating the state
- interpolates motion (TODO)
- calculates physical interaction (TODO)
*/
func (spaceSim *SpaceSimulator) Tick(delta time.Duration) {
	membershipNotices := spaceSim.collectMembershipNotices()
	for _, notice := range membershipNotices {
		// TODO compress duplicate membership notices
		if notice.Member == true {
			if notice.Avatar == true {
				_, err := spaceSim.createAvatar(notice.ClientUUID, []float64{0, 0, 0}, []float64{0, 0, 0, 1})
				if err != nil {
					logger.Println("Error creating avatar", err)
				}
			} else {
				spaceSim.Clients[notice.ClientUUID] = nil
			}
		} else {
			spaceSim.removeAvatar(notice.ClientUUID)
		}
	}

	avatarMotionNotices := spaceSim.collectAvatarMotionNotices()
	for _, notice := range avatarMotionNotices {
		// TODO compress duplicate motion notices
		avatarNode, ok := spaceSim.Clients[notice.ClientUUID]
		if ok == false {
			continue
		}
		if avatarNode == nil {
			continue // Received an update for a client with no Avatar!
		}
		avatarNode.Position.Set(notice.Position)
		avatarNode.Orientation.Set(notice.Orientation)
		avatarNode.Translation.Set(notice.Translation)
		avatarNode.Rotation.Set(notice.Rotation)
		avatarNode.Scale.Set(notice.Scale)
		avatarNode.handleBodyUpdates(notice.BodyUpdates)
	}

	nodeUpdateNotices := spaceSim.collectNodeUpdateNotices()
	for _, notice := range nodeUpdateNotices {
		// TODO Check that the client has permission to update the setting
		node := spaceSim.RootNode.findById(notice.Id)
		if node == nil {
			logger.Println("Received a setting update for an unknown node", notice)
			continue
		}
		for settingName, settingValue := range notice.Settings {
			node.SetOrCreateSetting(settingName, settingValue)
		}
		node.Position.Set(notice.Position)
		node.Orientation.Set(notice.Orientation)
		node.Translation.Set(notice.Translation)
		node.Rotation.Set(notice.Rotation)
		node.Scale.Set(notice.Scale)
		if notice.TemplateUUID != "" && notice.TemplateUUID != node.TemplateUUID.Value {
			node.TemplateUUID.Value = notice.TemplateUUID
			node.TemplateUUID.Dirty = true
		}
	}

	// Send new client clients full initialization updates
	if len(membershipNotices) > 0 {
		newClientUUIDs := []string{}
		for _, notice := range membershipNotices {
			if notice.Member == false {
				continue
			}
			newClientUUIDs = append(newClientUUIDs, notice.ClientUUID)
		}
		if len(newClientUUIDs) > 0 {
			err := spaceSim.SimHostServer.SendClientUpdate(spaceSim.UUID, spaceSim.Frame, newClientUUIDs, spaceSim.InitialAdditions(), []int64{}, []*NodeUpdate{})
			if err != nil {
				logger.Println("Error sending client initialization", err)
			}
		}
	}

	err := spaceSim.SimHostServer.SendClientUpdate(spaceSim.UUID, spaceSim.Frame, spaceSim.GetClientUUIDs(), spaceSim.Additions, spaceSim.Deletions, spaceSim.RootNode.getNodeUpdates())
	if err != nil {
		logger.Println("Error sending client update", err)
	}
	spaceSim.Additions = []*SceneAddition{}
	spaceSim.Deletions = []int64{}
	spaceSim.Frame = (spaceSim.Frame + 1) % math.MaxInt64
}

func (spaceSim *SpaceSimulator) GetClientUUIDs() []string {
	result := []string{}
	for uuid := range spaceSim.Clients {
		result = append(result, uuid)
	}
	return result
}

func (spaceSim *SpaceSimulator) collectMembershipNotices() []*ClientMembershipNotice {
	results := []*ClientMembershipNotice{}
	for {
		select {
		case item := <-spaceSim.ClientMembershipChannel:
			results = append(results, item)
		default:
			return results
		}
	}
}

func (spaceSim *SpaceSimulator) collectAvatarMotionNotices() []*AvatarMotionNotice {
	results := []*AvatarMotionNotice{}
	for {
		select {
		case item := <-spaceSim.AvatarMotionChannel:
			results = append(results, item)
		default:
			return results
		}
	}
}

func (spaceSim *SpaceSimulator) collectNodeUpdateNotices() []*NodeUpdateNotice {
	results := []*NodeUpdateNotice{}
	for {
		select {
		case item := <-spaceSim.NodeUpdateChannel:
			results = append(results, item)
		default:
			return results
		}
	}
}

/*
InitialAdditions returns SceneAdditions for every item in the space
*/
func (spaceSim *SpaceSimulator) InitialAdditions() []*SceneAddition {
	return spaceSim.additionsForSceneNode(spaceSim.RootNode, nil)
}

/*
additionsForSceneNode returns an array of SceneAdditions for the sceneNode and all children, recursively.
Parents are guaranteed to come earlier in the array than their children.
*/
func (spaceSim *SpaceSimulator) additionsForSceneNode(sceneNode *SceneNode, parentNode *SceneNode) []*SceneAddition {
	results := []*SceneAddition{}
	addition := &SceneAddition{
		Node: sceneNode,
	}
	if parentNode == nil {
		addition.ParentId = -1
	} else {
		addition.ParentId = parentNode.Id
	}
	results = append(results, addition)
	for _, childNode := range sceneNode.Nodes {
		results = append(results, spaceSim.additionsForSceneNode(childNode, sceneNode)...)
	}
	return results
}

/*
InitialState returns a string of JSON that encodes the intialization state of the space for storage in the space record
*/
func (spaceSim *SpaceSimulator) InitialState() string {
	buff := bytes.NewBufferString("")
	json.NewEncoder(buff).Encode(spaceSim.RootNode)
	return buff.String()
}

/*
ChangeClientMembership is called by the SimHost when a client connects and disconnects
It queues a notice that the simulator handles during a tick
*/
func (spaceSim *SpaceSimulator) ChangeClientMembership(clientUUID string, member bool, avatar bool) {
	spaceSim.ClientMembershipChannel <- &ClientMembershipNotice{
		ClientUUID: clientUUID,
		Member:     member,
		Avatar:     avatar,
	}
}

/*
HandleAvatarMotion is called by the sim host when it receives a message from a client via the WS service
*/
func (spaceSim *SpaceSimulator) HandleAvatarMotion(clientUUID string, position []float64, orientation []float64, translation []float64, rotation []float64, scale []float64, bodyUpdates []*BodyUpdate) {
	spaceSim.AvatarMotionChannel <- &AvatarMotionNotice{
		ClientUUID:  clientUUID,
		Position:    position,
		Orientation: orientation,
		Translation: translation,
		Rotation:    rotation,
		Scale:       scale,
		BodyUpdates: bodyUpdates,
	}
}

/*
HandleNodeUpdate is called by the sim host when it receives an update request message from a client via the WS service
*/
func (spaceSim *SpaceSimulator) HandleNodeUpdate(nodeId int64, settings map[string]string, position []float64, orientation []float64, translation []float64, rotation []float64, scale []float64, templateUUID string) {
	spaceSim.NodeUpdateChannel <- &NodeUpdateNotice{
		Id:           nodeId,
		Settings:     settings,
		Position:     position,
		Orientation:  orientation,
		Translation:  translation,
		Rotation:     rotation,
		Scale:        scale,
		TemplateUUID: templateUUID,
	}
}

func (spaceSim *SpaceSimulator) createAvatar(clientUUID string, position []float64, orientation []float64) (*SceneNode, error) {
	// Check for an existing avatar for this client
	node, ok := spaceSim.Clients[clientUUID]
	if ok == true {
		return node, nil
	}

	// Find the avatar and parts records
	avatarRecord, err := apiDB.FindAvatarRecord(spaceSim.DefaultAvatarUUID, spaceSim.DBInfo)
	if err != nil {
		return nil, err
	}
	// We're assuming that parts without parents are first in this list of parts so they're there when sub-parts are added
	partRecords, err := apiDB.FindAvatarPartRecordsForAvatar(avatarRecord.UUID, spaceSim.DBInfo)
	if err != nil {
		return nil, err
	}

	// Create the base avatar node
	state := apiDB.NewSpaceStateNode(position, orientation, "")
	node, err = NewSceneNode(state, spaceSim.DBInfo)
	if err != nil {
		return nil, err
	}
	node.Transient = true
	node.Settings["clientUUID"] = NewStringTuple("clientUUID", clientUUID)

	// Start additions list
	additions := []*SceneAddition{&SceneAddition{node, spaceSim.RootNode.Id}}
	partMap := make(map[string]*SceneNode)

	// Create the body part scene nodes, adding them to additions
	for _, partRecord := range partRecords {
		templateRecord, err := apiDB.FindTemplateRecordById(partRecord.Template, spaceSim.DBInfo)
		if err != nil {
			logger.Println("Could not find a template for a body part, ignoring:", partRecord.Template, partRecord)
			continue
		}
		position, err := partRecord.ParsePosition()
		if err != nil {
			logger.Println("Could not parse part record position, ignoring:", partRecord.Position)
			position = []float64{0, 0, 0}
		}
		orientation, err := partRecord.ParseOrientation()
		if err != nil {
			logger.Println("Could not parse part record orientation, ignoring:", partRecord.Orientation)
			orientation = []float64{0, 0, 0, 1}
		}
		scale, err := partRecord.ParseScale()
		if err != nil {
			logger.Println("Could not parse part record scale, ignoring:", partRecord.Scale)
			scale = []float64{1, 1, 1}
		}
		partNode := NewBodyPartSceneNode(partRecord.Part, templateRecord.UUID, position, orientation, scale)
		if partRecord.Parent != "" {
			parentNode, ok := partMap[partRecord.Parent]
			if ok == false {
				logger.Println("Could not find a parent for a part, ignoring:", partRecord.Part, partRecord.Parent)
				continue
			}
			parentNode.Add(partNode)
			additions = append(additions, &SceneAddition{partNode, parentNode.Id})
		} else {
			node.Add(partNode)
			additions = append(additions, &SceneAddition{partNode, node.Id})
		}
		partMap[partRecord.Part] = partNode
	}

	spaceSim.Clients[clientUUID] = node
	spaceSim.RootNode.Add(node)

	spaceSim.Additions = append(spaceSim.Additions, additions...)
	return node, nil
}

func (spaceSim *SpaceSimulator) removeAvatar(clientUUID string) {
	node, ok := spaceSim.Clients[clientUUID]
	if ok == false {
		return // Unknown avatar, ignoring
	}
	if node == nil {
		return // A client with no avatar
	}
	delete(spaceSim.Clients, clientUUID)
	spaceSim.Deletions = append(spaceSim.Deletions, node.Id)
	spaceSim.RootNode.Remove(node)
}

func NewRootNode(initialState *apiDB.SpaceStateNode, dbInfo *be.DBInfo) (*SceneNode, error) {
	rootNode := &SceneNode{
		Id:           nextSceneId(),
		Settings:     make(map[string]*StringTuple),
		TemplateUUID: NewStringField(""),
		Position:     NewVector3([]float64{0, 0, 0}),
		Orientation:  NewQuaternion([]float64{0, 0, 0, 1}),
		Translation:  NewVector3([]float64{0, 0, 0}),
		Rotation:     NewVector3([]float64{0, 0, 0}),
		Scale:        NewVector3([]float64{1, 1, 1}),
	}
	for key, value := range initialState.Settings {
		rootNode.Settings[key] = NewStringTuple(key, value)
	}
	for _, stateNode := range initialState.Nodes {
		childNode, err := NewSceneNode(&stateNode, dbInfo)
		if err != nil {
			return nil, err
		}
		if childNode.Transient == false {
			rootNode.Nodes = append(rootNode.Nodes, childNode)
		}
	}
	return rootNode, nil
}

type BodyUpdate struct {
	Name        string
	Position    *Vector3
	Orientation *Quaternion
	Translation *Vector3
	Rotation    *Vector3
}

/*
SceneNode is an element in a space's scene graph
*/
type SceneNode struct {
	Id           int64                   `json:"id"`
	Settings     map[string]*StringTuple `json:"settings"`
	Position     *Vector3                `json:"position"`
	Orientation  *Quaternion             `json:"orientation"`
	Translation  *Vector3                `json:"-"`
	Rotation     *Vector3                `json:"-"`
	Scale        *Vector3                `json:"scale"`
	TemplateUUID *StringField            `json:"templateUUID"`
	Nodes        []*SceneNode            `json:"nodes,omitempty"`
	Transient    bool                    `json:"transient"` // True if should be ignored when initializing a space (e.g. Avatar node)
}

func NewBodyPartSceneNode(name string, templateUUID string, position []float64, orientation []float64, scale []float64) *SceneNode {
	sceneNode := &SceneNode{
		Id:           nextSceneId(),
		TemplateUUID: NewStringField(templateUUID),
		Settings:     make(map[string]*StringTuple),
		Position:     NewVector3(position),
		Orientation:  NewQuaternion(orientation),
		Translation:  NewVector3([]float64{0, 0, 0}),
		Rotation:     NewVector3([]float64{0, 0, 0}),
		Scale:        NewVector3(scale),
		Nodes:        []*SceneNode{},
	}
	sceneNode.Settings["name"] = NewStringTuple("name", name)
	return sceneNode
}

func NewSceneNode(stateNode *apiDB.SpaceStateNode, dbInfo *be.DBInfo) (*SceneNode, error) {
	var templateRecord *apiDB.TemplateRecord
	var err error
	// We'd rather find a template by UUID, but use the (possibly non-unique) Name in a pinch
	if stateNode.TemplateUUID != "" {
		templateRecord, err = apiDB.FindTemplateRecord(stateNode.TemplateUUID, dbInfo)
		if err != nil {
			logger.Println("Error searching for template uuid: ", stateNode.TemplateUUID+": ", err)
			return nil, err
		}
	} else if stateNode.TemplateName != "" {
		templateRecord, err = apiDB.FindTemplateRecordByField("name", stateNode.TemplateName, dbInfo)
		if err != nil {
			logger.Println("Error searching for template name: ", stateNode.TemplateName+": ", err)
			return nil, err
		}
	}
	sceneNode := &SceneNode{
		Id:           nextSceneId(),
		Settings:     make(map[string]*StringTuple),
		TemplateUUID: NewStringField(""),
		Position:     NewVector3(stateNode.Position),
		Orientation:  NewQuaternion(stateNode.Orientation),
		Translation:  NewVector3([]float64{0, 0, 0}),
		Rotation:     NewVector3([]float64{0, 0, 0}),
		Scale:        NewVector3(stateNode.Scale),
		Nodes:        []*SceneNode{},
	}
	for key, value := range stateNode.Settings {
		sceneNode.Settings[key] = NewStringTuple(key, value)
	}
	for i := range sceneNode.Scale.Data {
		if sceneNode.Scale.Data[i] == 0 {
			sceneNode.Scale.Data[i] = 1
		}
	}

	if templateRecord != nil {
		sceneNode.TemplateUUID.Value = templateRecord.UUID
		sceneNode.TemplateUUID.Dirty = true
	}
	for _, childStateNode := range stateNode.Nodes {
		childNode, err := NewSceneNode(&childStateNode, dbInfo)
		if err != nil {
			return nil, err
		}
		if childNode.Transient == false {
			sceneNode.Nodes = append(sceneNode.Nodes, childNode)
		}
	}
	return sceneNode, nil
}

/*
getNodeUpdates lists each NodeUpdate in the hierarchy starting at this SceneNode iff they are dirty
This has the side effect of setting them clean
*/
func (node *SceneNode) getNodeUpdates() []*NodeUpdate {
	result := []*NodeUpdate{}
	if node.isDirty() {
		update := &NodeUpdate{
			Id:           node.Id,
			Settings:     []*StringTuple{},
			Position:     node.Position.ReadAndClean(),
			Orientation:  node.Orientation.ReadAndClean(),
			Translation:  node.Translation.ReadAndClean(),
			Rotation:     node.Rotation.ReadAndClean(),
			Scale:        node.Scale.ReadAndClean(),
			TemplateUUID: node.TemplateUUID.ReadAndClean(),
		}
		for _, tuple := range node.Settings {
			if tuple.Dirty {
				update.Settings = append(update.Settings, tuple)
				tuple.Dirty = false
			}
		}
		result = append(result, update)
	}
	for _, child := range node.Nodes {
		result = append(result, child.getNodeUpdates()...)
	}
	return result
}

func (node *SceneNode) handleBodyUpdates(bodyUpdates []*BodyUpdate) {
	for _, update := range bodyUpdates {
		childNode := node.findFirstChildBySetting("name", update.Name)
		if childNode == nil {
			logger.Println("Could not find body update node", node, update.Name)
			continue
		}
		childNode.Position.Copy(update.Position)
		childNode.Orientation.Copy(update.Orientation)
		childNode.Translation.Copy(update.Translation)
		childNode.Rotation.Copy(update.Rotation)
	}
}

func (node *SceneNode) findFirstChildBySetting(name string, value string) *SceneNode {
	for _, childNode := range node.Nodes {
		if childNode.SettingValue(name) == value {
			return childNode
		}
	}
	return nil
}

func (node *SceneNode) findById(id int64) *SceneNode {
	if node.Id == id {
		return node
	}
	for _, childNode := range node.Nodes {
		matchNode := childNode.findById(id)
		if matchNode != nil {
			return matchNode
		}
	}
	return nil
}

func (node *SceneNode) isDirty() bool {
	if node.Position.Dirty || node.Orientation.Dirty || node.Rotation.Dirty || node.Translation.Dirty || node.Scale.Dirty || node.TemplateUUID.Dirty {
		return true
	}
	for _, stringTuple := range node.Settings {
		if stringTuple.Dirty {
			return true
		}
	}
	return false
}

func (node *SceneNode) SetClean(includeChildren bool) {
	for _, stringTuple := range node.Settings {
		stringTuple.Dirty = false
	}
	node.Position.Dirty = false
	node.Orientation.Dirty = false
	node.Rotation.Dirty = false
	node.Translation.Dirty = false
	node.Scale.Dirty = false
	if includeChildren {
		for _, node := range node.Nodes {
			node.SetClean(includeChildren)
		}
	}
}

func (node *SceneNode) SettingValue(name string) string {
	setting, ok := node.Settings[name]
	if ok == false {
		return ""
	} else {
		return setting.Value
	}
}

func (node *SceneNode) SetOrCreateSetting(name string, value string) {
	setting, ok := node.Settings[name]
	if ok == false {
		node.Settings[name] = NewStringTuple(name, value)
		node.Settings[name].Dirty = true
	} else {
		setting.Value = value
		setting.Dirty = true
	}
}

func (node *SceneNode) Add(childNode *SceneNode) {
	node.Nodes = append(node.Nodes, childNode)
}

func (node *SceneNode) Remove(childNode *SceneNode) {
	results := []*SceneNode{}
	for _, n := range node.Nodes {
		if n.Id != childNode.Id {
			results = append(results, n)
		}
	}
	node.Nodes = results
}

type SceneAddition struct {
	Node     *SceneNode `json:"node"`
	ParentId int64      `json:"parent"`
}

type AvatarMotionNotice struct {
	ClientUUID  string
	Position    []float64
	Orientation []float64
	Translation []float64
	Rotation    []float64
	Scale       []float64
	BodyUpdates []*BodyUpdate
}

type NodeUpdateNotice struct {
	Id           int64
	Settings     map[string]string
	Position     []float64
	Orientation  []float64
	Translation  []float64
	Rotation     []float64
	Scale        []float64
	TemplateUUID string
}

type ClientMembershipNotice struct {
	ClientUUID string
	Member     bool
	Avatar     bool
}

type NodeUpdate struct {
	Id           int64
	Settings     []*StringTuple
	Position     []float64
	Orientation  []float64
	Translation  []float64
	Rotation     []float64
	Scale        []float64
	TemplateUUID string
}

type StringField struct {
	Dirty bool   `json:"-"`
	Value string `json:"value"`
}

func NewStringField(value string) *StringField {
	return &StringField{
		Dirty: false,
		Value: value,
	}
}

// If clean, return "", otherwise set clean and return the value
func (field *StringField) ReadAndClean() string {
	if field.Dirty == false {
		return ""
	}
	field.Dirty = false
	return field.Value
}

type StringTuple struct {
	Id    int64  `json:"id"`
	Dirty bool   `json:"-"`
	Key   string `json:"key"`
	Value string `json:"value"`
}

func NewStringTuple(key string, value string) *StringTuple {
	return &StringTuple{
		Id:    nextSceneId(),
		Dirty: false,
		Key:   key,
		Value: value,
	}
}

// If clean, return "", otherwise set clean and return the value
func (value *StringTuple) ReadAndClean() string {
	if value.Dirty == false {
		return ""
	}
	value.Dirty = false
	return value.Value
}

type Vector3 struct {
	Id    int64     `json:"id"`
	Dirty bool      `json:"-"`
	Data  []float64 `json:"data"`
}

func NewVector3(data []float64) *Vector3 {
	if data == nil || len(data) != 3 {
		data = []float64{0, 0, 0}
	}
	return &Vector3{
		Id:    nextSceneId(),
		Dirty: true,
		Data:  data,
	}
}

// If clean, return zero length []float64, otherwise set clean and return Data
func (value *Vector3) ReadAndClean() []float64 {
	if value.Dirty == false {
		return []float64{}
	}
	value.Dirty = false
	return value.Data
}

func (vector *Vector3) Set(data []float64) error {
	if len(data) != 3 {
		return errors.New(fmt.Sprintf("incorrect data length: %s", len(data)))
	}
	vector.Data[0] = data[0]
	vector.Data[1] = data[1]
	vector.Data[2] = data[2]
	vector.Dirty = true
	return nil
}

func (vector *Vector3) Copy(vec *Vector3) {
	vector.Data[0] = vec.Data[0]
	vector.Data[1] = vec.Data[1]
	vector.Data[2] = vec.Data[2]
	vector.Dirty = true
}

type Quaternion struct {
	Id    int64     `json:"id"`
	Dirty bool      `json:"-"`
	Data  []float64 `json:"data"`
}

func NewQuaternion(data []float64) *Quaternion {
	if data == nil || len(data) != 4 {
		data = []float64{0, 0, 0, 1}
	}
	return &Quaternion{
		Id:    nextSceneId(),
		Dirty: true,
		Data:  data,
	}
}

// If clean, return zero length []float64, otherwise set clean and return Data
func (quat *Quaternion) ReadAndClean() []float64 {
	if quat.Dirty == false {
		return []float64{}
	}
	quat.Dirty = false
	return quat.Data
}

func (quat *Quaternion) Set(data []float64) error {
	if len(data) != 4 {
		return errors.New(fmt.Sprintf("incorrect data length: %s", len(data)))
	}
	quat.Data[0] = data[0]
	quat.Data[1] = data[1]
	quat.Data[2] = data[2]
	quat.Data[3] = data[3]
	quat.Dirty = true
	return nil
}

func (quat *Quaternion) Copy(other *Quaternion) {
	quat.Data[0] = other.Data[0]
	quat.Data[1] = other.Data[1]
	quat.Data[2] = other.Data[2]
	quat.Data[3] = other.Data[3]
	quat.Dirty = true
}
