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
const TICKS_BETWEEN_SAVES = 30 * 10          // Save space state to the DB after this many ticks

const REMOVE_KEY_INDICATOR = "_r_e_m_o_v_e_"

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
	TicksSinceSaved   int64 // The number of ticks since the state was last saved to the SpaceRecord

	ClientMembershipChannel chan *ClientMembershipNotice
	AvatarMotionChannel     chan *AvatarMotionNotice
	AddNodeChannel          chan *AddNodeNotice
	RemoveNodeChannel       chan *RemoveNodeNotice
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
	if rootNode.SettingValue("name") == "" {
		rootNode.SetOrCreateSetting("name", "Root Node")
	}
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
		AddNodeChannel:          make(chan *AddNodeNotice, 1024),
		RemoveNodeChannel:       make(chan *RemoveNodeNotice, 1024),
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
				_, err := spaceSim.createAvatar(notice.ClientUUID, notice.UserUUID, []float64{0, 0, 0}, []float64{0, 0, 0, 1})
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
			if settingValue == REMOVE_KEY_INDICATOR {
				node.RemoveSetting(settingName)
			} else {
				node.SetOrCreateSetting(settingName, settingValue)
			}
		}
		node.Position.Set(notice.Position)
		node.Orientation.Set(notice.Orientation)
		node.Translation.Set(notice.Translation)
		node.Rotation.Set(notice.Rotation)
		node.Scale.Set(notice.Scale)
		if notice.TemplateUUID != "" && notice.TemplateUUID != node.TemplateUUID.Value {
			node.TemplateUUID.Value = notice.TemplateUUID // May be REMOVE_KEY_INDICATOR
			node.TemplateUUID.Dirty = true
		}
	}

	addNodeNotices := spaceSim.collectAddNodeNotices()
	for _, notice := range addNodeNotices {
		// TODO Check that the client has permission to add a node
		parentNode := spaceSim.RootNode.findById(notice.Parent)
		if parentNode == nil {
			logger.Println("Received an add node request for an unknown parent node", notice)
			continue
		}
		state := apiDB.NewSpaceStateNode(notice.Position, notice.Orientation, []float64{0, 0, 0}, []float64{0, 0, 0}, []float64{0, 0, 0}, notice.TemplateUUID)
		childNode, err := NewSceneNode(state, spaceSim.DBInfo)
		if err != nil {
			logger.Println("Could not create a new node", err)
			continue
		}
		childNode.SetOrCreateSetting("name", "")
		parentNode.Add(childNode)
		spaceSim.Additions = append(spaceSim.Additions, &SceneAddition{childNode, parentNode.Id})
	}

	removeNodeNotices := spaceSim.collectRemoveNodeNotices()
	for _, notice := range removeNodeNotices {
		// TODO Check that the client has permission to remove the node
		node, parent := spaceSim.RootNode.findNodeAndParentById(notice.Id)
		if node == nil {
			logger.Println("Received a remove node request for an unknown node", notice)
			continue
		}
		spaceSim.Deletions = append(spaceSim.Deletions, node.Id)
		parent.Remove(node)
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

	spaceSim.TicksSinceSaved += 1
	if spaceSim.TicksSinceSaved > TICKS_BETWEEN_SAVES {
		spaceSim.TicksSinceSaved = 0
		err = spaceSim.SaveState()
		if err != nil {
			logger.Println("Could not save state", err)
		}
	}
}

func (spaceSim *SpaceSimulator) SaveState() error {
	return apiDB.UpdateSpaceState(spaceSim.UUID, spaceSim.RootNode.toSpaceStateNode().ToString(), spaceSim.DBInfo)
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

func (spaceSim *SpaceSimulator) collectAddNodeNotices() []*AddNodeNotice {
	results := []*AddNodeNotice{}
	for {
		select {
		case item := <-spaceSim.AddNodeChannel:
			results = append(results, item)
		default:
			return results
		}
	}
}

func (spaceSim *SpaceSimulator) collectRemoveNodeNotices() []*RemoveNodeNotice {
	results := []*RemoveNodeNotice{}
	for {
		select {
		case item := <-spaceSim.RemoveNodeChannel:
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
func (spaceSim *SpaceSimulator) ChangeClientMembership(clientUUID string, userUUID string, member bool, avatar bool) {
	spaceSim.ClientMembershipChannel <- &ClientMembershipNotice{
		ClientUUID: clientUUID,
		UserUUID:   userUUID,
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

func (spaceSim *SpaceSimulator) HandleAddNode(parentId int64, templateUUID string, position []float64, orientation []float64) {
	spaceSim.AddNodeChannel <- &AddNodeNotice{
		Parent:       parentId,
		TemplateUUID: templateUUID,
		Position:     position,
		Orientation:  orientation,
	}
}

func (spaceSim *SpaceSimulator) HandleRemoveNode(id int64) {
	spaceSim.RemoveNodeChannel <- &RemoveNodeNotice{
		Id: id,
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

func (spaceSim *SpaceSimulator) createAvatar(clientUUID string, userUUID string, position []float64, orientation []float64) (*SceneNode, error) {
	// Check for an existing avatar for this client
	node, ok := spaceSim.Clients[clientUUID]
	if ok == true {
		return node, nil
	}

	avatarUUID := spaceSim.DefaultAvatarUUID
	if userUUID != "" {
		userRecord, err := be.FindUser(userUUID, spaceSim.DBInfo)
		if err == nil && userRecord.AvatarUUID != "" {
			userAvatarRecord, err := apiDB.FindAvatarRecord(userRecord.AvatarUUID, spaceSim.DBInfo)
			if err == nil {
				avatarUUID = userAvatarRecord.UUID
			} else {
				logger.Println("Could not find avatar for user", avatarUUID)
			}
		}
	}

	// Find the avatar and parts records
	avatarRecord, err := apiDB.FindAvatarRecord(avatarUUID, spaceSim.DBInfo)
	if err != nil {
		return nil, err
	}
	// We're assuming that parts without parents are first in this list of parts so they're there when sub-parts are added
	partRecords, err := apiDB.FindAvatarPartRecordsForAvatar(avatarRecord.UUID, spaceSim.DBInfo)
	if err != nil {
		return nil, err
	}

	// Create the base avatar node
	state := apiDB.NewSpaceStateNode(position, orientation, []float64{0, 0, 0}, []float64{0, 0, 0}, []float64{0, 0, 0}, "")
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
		templateUUID := ""
		if partRecord.TemplateUUID != "" {
			templateRecord, err := apiDB.FindTemplateRecord(partRecord.TemplateUUID, spaceSim.DBInfo)
			if err == nil {
				templateUUID = templateRecord.UUID
			} else {
				logger.Println("Could not find a template for a body part, ignoring:", partRecord.TemplateUUID, partRecord)
			}
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
		partNode := NewBodyPartSceneNode(partRecord.Part, templateUUID, position, orientation, scale)
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
	Id           int64
	Settings     map[string]*StringTuple
	Position     *Vector3
	Orientation  *Quaternion
	Translation  *Vector3
	Rotation     *Vector3
	Scale        *Vector3
	TemplateUUID *StringField
	Nodes        []*SceneNode
	Transient    bool // True if ignored when serializing to a SpaceStateNode (e.g. this is an Avatar node)
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

func (node *SceneNode) toSpaceStateNode() *apiDB.SpaceStateNode {
	stateNode := apiDB.NewSpaceStateNode(node.Position.Data, node.Orientation.Data, node.Translation.Data, node.Rotation.Data, node.Scale.Data, node.TemplateUUID.Value)
	for _, setting := range node.Settings {
		stateNode.Settings[setting.Key] = setting.Value
	}
	for _, child := range node.Nodes {
		if child.Transient {
			continue
		}
		stateNode.Nodes = append(stateNode.Nodes, *child.toSpaceStateNode())
	}
	return stateNode
}

/*
getNodeUpdates lists each NodeUpdate in the hierarchy starting at this SceneNode iff they are dirty
This has the side effects of setting them clean and removing each Settings tuple with a Value of REMOVE_KEY_INDICATOR
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
			TemplateUUID: node.TemplateUUID.ReadAndClean(), // May be REMOVE_KEY_INDICATOR
		}
		for key, tuple := range node.Settings {
			if tuple.Dirty {
				update.Settings = append(update.Settings, tuple)
				if tuple.Value == REMOVE_KEY_INDICATOR {
					delete(node.Settings, key)
				} else {
					tuple.Dirty = false
				}
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

func (node *SceneNode) findNodeAndParentById(nodeId int64) (*SceneNode, *SceneNode) {
	for _, childNode := range node.Nodes {
		if childNode.Id == nodeId {
			return childNode, node
		}
		matchNode, matchParent := childNode.findNodeAndParentById(nodeId)
		if matchNode != nil {
			return matchNode, matchParent
		}
	}
	return nil, nil
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

func (node *SceneNode) RemoveSetting(name string) {
	_, ok := node.Settings[name]
	if ok == false {
		return
	}
	node.Settings[name].Value = REMOVE_KEY_INDICATOR
	node.Settings[name].Dirty = true
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

type AddNodeNotice struct {
	Parent       int64
	TemplateUUID string
	Position     []float64
	Orientation  []float64
}

type RemoveNodeNotice struct {
	Id int64
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
	UserUUID   string
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
	if field.Value != REMOVE_KEY_INDICATOR {
		return field.Value
	}
	field.Value = ""
	return REMOVE_KEY_INDICATOR
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
