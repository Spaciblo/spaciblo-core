package db

import (
	"bytes"
	"encoding/json"
	"io"
	"spaciblo.org/be"
)

const SpaceTable = "spaces"

type SpaceRecord struct {
	Id     int64  `json:"id" db:"id, primarykey, autoincrement"`
	UUID   string `json:"uuid" db:"u_u_i_d"`
	Name   string `json:"name" db:"name"`
	State  string `json:"-"`      // A JSON blob that stores a serialized SpaceStateNode scene graph and settings to initialize a space in a sim
	Avatar string `json:"avatar"` // The template UUID of the default Avatar for the space
}

func (record *SpaceRecord) DecodeState() (*SpaceStateNode, error) {
	return DecodeSpaceStateNode(bytes.NewBufferString(record.State))
}

func CreateSpaceRecord(name string, state string, avatarTemplateUUID string, dbInfo *be.DBInfo) (*SpaceRecord, error) {
	record := &SpaceRecord{
		Name:   name,
		UUID:   be.UUID(),
		State:  state,
		Avatar: avatarTemplateUUID,
	}
	err := dbInfo.Map.Insert(record)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func DeleteAllSpaceRecords(dbInfo *be.DBInfo) error {
	records, err := FindAllSpaceRecords(dbInfo)
	if err != nil {
		return err
	}
	for _, record := range records {
		_, err = dbInfo.Map.Delete(record)
		if err != nil {
			return err
		}
	}
	return nil
}

func FindSpaceRecord(uuid string, dbInfo *be.DBInfo) (*SpaceRecord, error) {
	return findSpaceByField("u_u_i_d", uuid, dbInfo)
}

func FindSpaceRecords(offset int, limit int, dbInfo *be.DBInfo) ([]SpaceRecord, error) {
	var records []SpaceRecord
	_, err := dbInfo.Map.Select(&records, "select * from "+SpaceTable+" order by id desc limit $1 offset $2", limit, offset)
	return records, err
}

func FindAllSpaceRecords(dbInfo *be.DBInfo) ([]*SpaceRecord, error) {
	var records []*SpaceRecord
	_, err := dbInfo.Map.Select(&records, "select * from "+SpaceTable+" order by id desc")
	return records, err
}

func findSpaceByField(fieldName string, value string, dbInfo *be.DBInfo) (*SpaceRecord, error) {
	record := new(SpaceRecord)
	err := dbInfo.Map.SelectOne(record, "select * from "+SpaceTable+" where "+fieldName+"=$1", value)
	if err != nil {
		return nil, err
	}
	return record, nil
}

/*
SpaceStateNode is used to serialize and parse a JSON file that holds a space's initialization state
Its serialized form is IDENTICAL to a serialized hierarchy of simulator SceneNode instances.
Use SpaceStateNode when reading space.json files into the DB or passing around initialization state.
Use SceneNode when in the simulator.
*/
type SpaceStateNode struct {
	Settings     map[string]string `json:"settings,omitempty"`      // Contains node specific settings like <background-color, #44DDFF>
	Position     []float64         `json:"position,omitempty"`      // x,y,z
	Orientation  []float64         `json:"orientation,omitempty"`   // x, y, z, w
	Scale        []float64         `json:"scale,omitempty"`         // x,y,z
	TemplateName string            `json:"template-name,omitempty"` // Templates can be referenced by names (which are not unique) or by UUID (which are)
	TemplateUUID string            `json:"template-uuid,omitempty"`
	Nodes        []SpaceStateNode  `json:"nodes,omitempty"`
}

func NewSpaceStateNode(position []float64, orientation []float64, templateUUID string) *SpaceStateNode {
	return &SpaceStateNode{
		Settings:     make(map[string]string),
		Position:     position,
		Orientation:  orientation,
		Scale:        []float64{1, 1, 1},
		TemplateUUID: templateUUID,
	}
}

func (stateNode *SpaceStateNode) Encode(writer io.Writer) error {
	return json.NewEncoder(writer).Encode(stateNode)
}

func (stateNode *SpaceStateNode) ToString() string {
	buff := bytes.NewBufferString("")
	err := stateNode.Encode(buff)
	if err != nil {
		logger.Println("Could not encode StateNode", err)
		return ""
	}
	return buff.String()
}

func DecodeSpaceStateNode(jsonFile io.Reader) (*SpaceStateNode, error) {
	state := new(SpaceStateNode)
	err := json.NewDecoder(jsonFile).Decode(state)
	if err != nil {
		return nil, err
	}
	return state, nil
}
