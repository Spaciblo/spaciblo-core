package sim

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
)

const TICK_DURATION = time.Millisecond * 1000 // TODO switch back to 10 ticks per second

var currentSceneId int64 = -1

func nextSceneId() int64 {
	currentSceneId += 1
	return currentSceneId
}

/*
SpaceSimulator holds all of the state for a space and can step the simulation forward through "time"
It does not handle any of the communication with clients. That's the job of the SimHostServer.
*/
type SpaceSimulator struct {
	Running           bool                  // True if the simulator should be automatically ticking
	Name              string                // The Name of the SpaceRecord
	UUID              string                // The UUID of the SpaceRecord
	RootNode          *SceneNode            // The scene graph, including SceneNodes for avatars
	Avatars           map[string]*SceneNode // <clientUUID, avatar node>
	Additions         []*SceneAddition      // Nodes added to the scene since the last tick
	Deletions         []int64               // Node IDs removed from the scene since the last tick
	DefaultAvatarUUID string
	SimHostServer     *SimHostServer
	DBInfo            *be.DBInfo

	ClientMembershipChannel chan *ClientMembershipNotice
	AvatarMotionChannel     chan *AvatarMotionNotice
}

func NewSpaceSimulator(name string, spaceUUID string, initialState *apiDB.SpaceStateNode, simHostServer *SimHostServer, dbInfo *be.DBInfo) (*SpaceSimulator, error) {
	rootNode, err := NewRootNode(initialState, dbInfo)
	if err != nil {
		return nil, err
	}

	templateRecord, err := apiDB.FindTemplateRecordByField("name", "Box", dbInfo) // TODO Stop hard coding Box
	if err != nil {
		logger.Println("Error searching for default avatar template: Box: ", err)
		return nil, err
	}

	return &SpaceSimulator{
		Running:           false,
		Name:              name,
		UUID:              spaceUUID,
		RootNode:          rootNode,
		Avatars:           make(map[string]*SceneNode),
		Additions:         []*SceneAddition{},
		Deletions:         []int64{},
		DefaultAvatarUUID: templateRecord.UUID,
		SimHostServer:     simHostServer,
		DBInfo:            dbInfo,

		ClientMembershipChannel: make(chan *ClientMembershipNotice, 1024),
		AvatarMotionChannel:     make(chan *AvatarMotionNotice, 1024),
	}, nil
}

func (spaceSim *SpaceSimulator) StartTime() {
	if spaceSim.Running {
		return
	}
	spaceSim.Running = true
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
		logger.Println("Membership notice", notice)
		// TODO compress duplicate membership notices
		if notice.Member == true {
			spaceSim.createAvatar(notice.ClientUUID, []float64{0, 0, 0}, []float64{0, 0, 0, 1})
		} else {
			spaceSim.removeAvatar(notice.ClientUUID)
		}
	}

	avatarMotionNotices := spaceSim.collectAvatarMotionNotices()
	for _, notice := range avatarMotionNotices {
		logger.Println("Avatar motion notice", notice)
		// TODO compress duplicate motion notices
	}

	// Send new client initialization messages
	if len(membershipNotices) > 0 {
		newClientUUIDs := []string{}
		for _, notice := range membershipNotices {
			if notice.Member == false {
				continue
			}
			newClientUUIDs = append(newClientUUIDs, notice.ClientUUID)
		}
		if len(newClientUUIDs) > 0 {
			err := spaceSim.SimHostServer.SendSpaceInitialization(spaceSim.UUID, newClientUUIDs, spaceSim.InitialState())
			if err != nil {
				logger.Println("Error sending client initialization", err)
			}
		}
	}

	err := spaceSim.SimHostServer.SendClientUpdate(spaceSim.UUID, spaceSim.GetClientUUIDs())
	if err != nil {
		logger.Println("Error sending client update", err)
	}
}

func (spaceSim *SpaceSimulator) GetClientUUIDs() []string {
	result := []string{}
	for uuid := range spaceSim.Avatars {
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

func (spaceSim *SpaceSimulator) InitialState() string {
	buff := bytes.NewBufferString("")
	json.NewEncoder(buff).Encode(spaceSim.RootNode)
	return buff.String()
}

/*
ChangeClientMembership is called by the SimHost when a client connects and disconnects
It queues a notice that the simulator handles during a tick
*/
func (spaceSim *SpaceSimulator) ChangeClientMembership(clientUUID string, member bool) {
	spaceSim.ClientMembershipChannel <- &ClientMembershipNotice{
		ClientUUID: clientUUID,
		Member:     member,
	}
}

func (spaceSim *SpaceSimulator) HandleAvatarMotion(clientUUID string, position []float64, orientation []float64, translation []float64, rotation []float64) {
	spaceSim.AvatarMotionChannel <- &AvatarMotionNotice{
		ClientUUID:  clientUUID,
		Position:    position,
		Orientation: orientation,
		Translation: translation,
		Rotation:    rotation,
	}
}

func (spaceSim *SpaceSimulator) createAvatar(clientUUID string, position []float64, orientation []float64) (*SceneNode, error) {
	node, ok := spaceSim.Avatars[clientUUID]
	if ok == true {
		return node, nil
	}
	state := apiDB.NewSpaceStateNode(position, orientation, spaceSim.DefaultAvatarUUID)
	node, err := NewSceneNode(state, spaceSim.DBInfo)
	if err != nil {
		return nil, err
	}
	node.Transient = true
	node.Settings["clientUUID"] = NewStringTuple("clientUUID", clientUUID)
	spaceSim.Avatars[clientUUID] = node
	spaceSim.RootNode.Add(node)
	spaceSim.Additions = append(spaceSim.Additions, &SceneAddition{node, spaceSim.RootNode.Id})
	return node, nil
}

func (spaceSim *SpaceSimulator) removeAvatar(clientUUID string) {
	node, ok := spaceSim.Avatars[clientUUID]
	logger.Println("Remove avatar", clientUUID, ok)
	if ok == false {
		// Unknown avatar, ignoring
		return
	}
	delete(spaceSim.Avatars, clientUUID)
	spaceSim.Deletions = append(spaceSim.Deletions, node.Id)
	spaceSim.RootNode.Remove(node)
}

func NewRootNode(initialState *apiDB.SpaceStateNode, dbInfo *be.DBInfo) (*SceneNode, error) {
	rootNode := &SceneNode{
		Id:          nextSceneId(),
		Settings:    make(map[string]*StringTuple),
		Position:    NewVector3([]float64{0, 0, 0}),
		Orientation: NewQuaternion([]float64{0, 0, 0, 1}),
		Scale:       NewVector3([]float64{1, 1, 1}),
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

type SceneNode struct {
	Id           int64                   `json:"id"`
	Settings     map[string]*StringTuple `json:"settings"`
	Position     *Vector3                `json:"position"`
	Orientation  *Quaternion             `json:"orientation"`
	Scale        *Vector3                `json:"scale"`
	TemplateUUID string                  `json:"templateUUID"`
	Nodes        []*SceneNode            `json:"nodes,omitempty"`
	Transient    bool                    `json:"transient"` // True if should be ignored when initializing a space (e.g. Avatar node)
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
		Id:          nextSceneId(),
		Settings:    make(map[string]*StringTuple),
		Position:    NewVector3(stateNode.Position),
		Orientation: NewQuaternion(stateNode.Orientation),
		Scale:       NewVector3(stateNode.Scale),
		Nodes:       []*SceneNode{},
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
		sceneNode.TemplateUUID = templateRecord.UUID
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

func (node *SceneNode) SettingValue(name string) string {
	setting, ok := node.Settings[name]
	if ok == false {
		return ""
	} else {
		return setting.Value
	}
}

func (node *SceneNode) Add(childNode *SceneNode) {
	node.Nodes = append(node.Nodes, childNode)
}

func (node *SceneNode) Remove(childNode *SceneNode) {
	for i, n := range node.Nodes {
		if n.Id == childNode.Id {
			if i == len(node.Nodes)-1 {
				node.Nodes = node.Nodes[:i]
			} else {
				node.Nodes = append(node.Nodes[:i], node.Nodes[i+i:]...)
			}
			return
		}
	}
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
}

type ClientMembershipNotice struct {
	ClientUUID string
	Member     bool
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
