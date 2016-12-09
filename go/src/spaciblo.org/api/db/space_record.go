package db

import (
	"bytes"
	"encoding/json"
	"io"
	"spaciblo.org/be"
)

const SpaceTable = "spaces"

type SpaceRecord struct {
	Id    int64  `json:"id" db:"id, primarykey, autoincrement"`
	UUID  string `json:"uuid" db:"u_u_i_d"`
	Name  string `json:"name" db:"name"`
	State string `json:"-"` // A JSON blob that stores a serialized SpaceStateFile scene graph and settings to initialize a space in a sim
}

func (record *SpaceRecord) DecodeState() (*SpaceStateFile, error) {
	return DecodeSpaceStateFile(bytes.NewBufferString(record.State))
}

func CreateSpaceRecord(name string, state string, dbInfo *be.DBInfo) (*SpaceRecord, error) {
	record := &SpaceRecord{
		Name:  name,
		UUID:  be.UUID(),
		State: state,
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
SpaceStateFile is used to serialize and parse a JSON file that holds a space's initialization state
*/
type SpaceStateFile struct {
	Settings map[string]string `json:"settings,omitempty"` // Contains space-wide settings like <background-color, #44DDFF>
	Nodes    []SpaceStateNode  `json:"nodes,omitempty"`    // An array of positioned templates to be added to the scene on initialization
}

func (stateFile *SpaceStateFile) Encode(writer io.Writer) error {
	return json.NewEncoder(writer).Encode(stateFile)
}

/*
SpaceStateNode is a node in the SpaceStateFile hierarchy of groups, templates, and settings
*/
type SpaceStateNode struct {
	Settings     map[string]string `json:"settings,omitempty"`      // Contains node specific settings like <background-color, #44DDFF>
	Position     []float64         `json:"position,omitempty"`      // x,y,z
	Rotation     []float64         `json:"rotation,omitempty"`      // three numbers or four numbers in this array are parsed as euler or quaternion values, respectively
	Scale        []float64         `json:"scale,omitempty"`         // x,y,z
	TemplateName string            `json:"template-name,omitempty"` // Templates can be referenced by names (which are not unique) or by UUID (which are)
	TemplateUUID string            `json:"template-uuid,omitempty"`

	Nodes []SpaceStateNode `json:"nodes,omitempty"`
}

func DecodeSpaceStateFile(jsonFile io.Reader) (*SpaceStateFile, error) {
	state := new(SpaceStateFile)
	err := json.NewDecoder(jsonFile).Decode(state)
	if err != nil {
		return nil, err
	}
	return state, nil
}
