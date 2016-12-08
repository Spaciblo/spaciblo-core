package sim

import (
	"bytes"
	"encoding/json"
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
	Name     string // The Name of the SpaceRecord
	UUID     string // The UUID of the SpaceRecord
	RootNode *SceneNode
}

func NewSpaceSimulator(name string, uuid string, initialState *apiDB.SpaceStateFile, dbInfo *be.DBInfo) (*SpaceSimulator, error) {
	rootNode, err := NewRootNode(initialState, dbInfo)
	if err != nil {
		return nil, err
	}
	return &SpaceSimulator{name, uuid, rootNode}, nil
}

func (spaceSim *SpaceSimulator) InitialState() string {
	buff := bytes.NewBufferString("")
	json.NewEncoder(buff).Encode(spaceSim.RootNode)
	return buff.String()
}

func NewRootNode(initialState *apiDB.SpaceStateFile, dbInfo *be.DBInfo) (*SceneNode, error) {
	rootNode := &SceneNode{
		Id:       nextSceneId(),
		Settings: make(map[string]*StringTuple),
		Position: NewVector3([]float64{0, 0, 0}),
		Rotation: NewQuaternion([]float64{0, 0, 0, 1}),
		Scale:    NewVector3([]float64{1, 1, 1}),
	}
	rootNode.Settings["Name"] = NewStringTuple("Name", initialState.Name)
	for _, stateNode := range initialState.Nodes {
		childNode, err := NewSceneNode(stateNode, dbInfo)
		if err != nil {
			return nil, err
		}
		rootNode.Nodes = append(rootNode.Nodes, childNode)
	}
	return rootNode, nil
}

type SceneNode struct {
	Id           int64                   `json:"id"`
	Settings     map[string]*StringTuple `json:"settings"` // Includes Name
	Position     *Vector3                `json:"position"`
	Rotation     *Quaternion             `json:"rotation"`
	Scale        *Vector3                `json:"scale"`
	TemplateUUID string                  `json:"templateUUID"`
	Nodes        []*SceneNode            `json:"nodes,omitempty"`
}

func NewSceneNode(stateNode apiDB.SpaceStateNode, dbInfo *be.DBInfo) (*SceneNode, error) {
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
		Id:       nextSceneId(),
		Settings: make(map[string]*StringTuple),
		Position: NewVector3(stateNode.Position),
		Rotation: NewQuaternion(stateNode.Rotation),
		Scale:    NewVector3(stateNode.Scale),
		Nodes:    []*SceneNode{},
	}
	if stateNode.Name != "" {
		sceneNode.Settings["Name"] = NewStringTuple("Name", stateNode.Name)
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
		childNode, err := NewSceneNode(childStateNode, dbInfo)
		if err != nil {
			return nil, err
		}
		sceneNode.Nodes = append(sceneNode.Nodes, childNode)
	}
	return sceneNode, nil
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
	if data == nil {
		data = []float64{0, 0, 0}
	}
	return &Vector3{
		Id:    nextSceneId(),
		Dirty: true,
		Data:  data,
	}
}

type Quaternion struct {
	Id    int64     `json:"id"`
	Dirty bool      `json:"-"`
	Data  []float64 `json:"data"`
}

func NewQuaternion(data []float64) *Quaternion {
	if data == nil {
		data = []float64{0, 0, 0, 1}
	}
	return &Quaternion{
		Id:    nextSceneId(),
		Dirty: true,
		Data:  data,
	}
}
