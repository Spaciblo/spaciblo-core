package sim

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
)

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
	Name              string                // The Name of the SpaceRecord
	UUID              string                // The UUID of the SpaceRecord
	RootNode          *SceneNode            // The scene graph, including SceneNodes for avatars
	Avatars           map[string]*SceneNode // <clientUUID, avatar node>
	Additions         []*SceneAddition      // Nodes added to the scene since the last tick
	Deletions         []int64               // Node IDs removed from the scene since the last tick
	DefaultAvatarUUID string
	DBInfo            *be.DBInfo
}

func NewSpaceSimulator(name string, spaceUUID string, initialState *apiDB.SpaceStateNode, dbInfo *be.DBInfo) (*SpaceSimulator, error) {
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
		Name:              name,
		UUID:              spaceUUID,
		RootNode:          rootNode,
		Avatars:           make(map[string]*SceneNode),
		Additions:         []*SceneAddition{},
		Deletions:         []int64{},
		DefaultAvatarUUID: templateRecord.UUID,
		DBInfo:            dbInfo,
	}, nil
}

func (spaceSim *SpaceSimulator) InitialState() string {
	buff := bytes.NewBufferString("")
	json.NewEncoder(buff).Encode(spaceSim.RootNode)
	return buff.String()
}

func (spaceSim *SpaceSimulator) AddAvatar(clientUUID string, position []float64, orientation []float64) (*SceneNode, error) {
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

func (spaceSim *SpaceSimulator) RemoveAvatar(clientUUID string) {
	node, ok := spaceSim.Avatars[clientUUID]
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
