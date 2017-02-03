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
	Avatar string `json:"avatar"` // The UUID of the default AvatarRecord for the space
}

func (record *SpaceRecord) DecodeState() (*SpaceStateNode, error) {
	return DecodeSpaceStateNode(bytes.NewBufferString(record.State))
}

func CreateSpaceRecord(name string, state string, avatarUUID string, dbInfo *be.DBInfo) (*SpaceRecord, error) {
	record := &SpaceRecord{
		Name:   name,
		UUID:   be.UUID(),
		State:  state,
		Avatar: avatarUUID,
	}
	err := dbInfo.Map.Insert(record)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func UpdateSpaceState(uuid string, state string, dbInfo *be.DBInfo) error {
	// TODO update just the state column
	record, err := FindSpaceRecord(uuid, dbInfo)
	if err != nil {
		return err
	}
	record.State = state
	return UpdateSpaceRecord(record, dbInfo)
}

func UpdateSpaceRecord(record *SpaceRecord, dbInfo *be.DBInfo) error {
	_, err := dbInfo.Map.Update(record)
	return err
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
SpaceStateNode is used to serialize and parse JSON that holds a space's initialization state.
Use SpaceStateNode when reading space.json files into the DB or passing around initialization state.
*/
type SpaceStateNode struct {
	Settings     map[string]string `json:"settings,omitempty"`      // Contains node specific settings like <background-color, #44DDFF>
	Position     []float64         `json:"position,omitempty"`      // x,y,z
	Orientation  []float64         `json:"orientation,omitempty"`   // x, y, z, w
	Translation  []float64         `json:"translation,omitempty"`   // x,y,z motion speed
	Rotation     []float64         `json:"rotation,omitempty"`      // x,y,z rotational speed
	Scale        []float64         `json:"scale,omitempty"`         // x,y,z
	TemplateName string            `json:"template-name,omitempty"` // Templates can be referenced by names (which are not unique) or by UUID (which are)
	TemplateUUID string            `json:"template-uuid,omitempty"`
	Nodes        []SpaceStateNode  `json:"nodes,omitempty"`
}

func NewEmptySpaceStateNode() *SpaceStateNode {
	return NewSpaceStateNode([]float64{0, 0, 0}, []float64{0, 0, 0, 1}, []float64{0, 0, 0}, []float64{0, 0, 0}, []float64{0, 0, 0}, "")
}

func NewSpaceStateNode(position []float64, orientation []float64, translation []float64, rotation []float64, scale []float64, templateUUID string) *SpaceStateNode {
	return &SpaceStateNode{
		Settings:     make(map[string]string),
		Position:     position,
		Orientation:  orientation,
		Translation:  translation,
		Rotation:     rotation,
		Scale:        scale,
		TemplateUUID: templateUUID,
		Nodes:        []SpaceStateNode{},
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
