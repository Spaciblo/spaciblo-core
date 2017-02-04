package db

import (
	"encoding/json"
	"errors"
	"io"
	"spaciblo.org/be"
	"strconv"
	"strings"
)

const AvatarTable = "avatars"
const AvatarPartTable = "avatar_parts"
const DefaultAvatarName = "Default Avatar"

/*
AvatarPartRecord associates an AvatarRecord with a TemplateRecord that represents a head, hand, torso, etc
*/
type AvatarPartRecord struct {
	Id          int64  `json:"id" db:"id, primarykey, autoincrement"`
	UUID        string `json:"uuid" db:"u_u_i_d"`
	Avatar      int64  `json:"avatar" db:"avatar"`           // TODO make this a foreign key
	Template    int64  `json:"template" db:"template"`       // TODO make this a foreign key
	Name        string `json:"name" db:"name"`               // A human readable name, like "Left Lobster Claw"
	Part        string `json:"part" db:"part"`               // System short name like "head", "torso", "left_hand", or "right_hand"
	Parent      string `json:"parent" db:"parent"`           // The AvatarPartRecord.Part name of the scene graph parent of this part, empty if the parent is the root of the avatar
	Position    string `json:"position" db:"position"`       // "x,y,z" vector3 relative to avatar origin TODO figure out how to use PostgreSQL array types
	Orientation string `json:"orientation" db:"orientation"` // "x,y,z,w" quaternion relative to avatar origin
	Scale       string `json:"scale" db:"scale"`             // "x,y,z" scale of the part
	// TODO offer avatar part customization of textures, colors, morphs, positioning, etc
}

func (record *AvatarPartRecord) ParsePosition() ([]float64, error) {
	return decodeFloatArrayString(record.Position, 3, []float64{0, 0, 0})
}

func (record *AvatarPartRecord) SetPosition(x float64, y float64, z float64) {
	record.Position = encodeFloatArrayString([]float64{x, y, z})
}

func (record *AvatarPartRecord) ParseOrientation() ([]float64, error) {
	return decodeFloatArrayString(record.Orientation, 4, []float64{0, 0, 0, 1})
}

func (record *AvatarPartRecord) SetOrientation(x float64, y float64, z float64, w float64) {
	record.Orientation = encodeFloatArrayString([]float64{x, y, z, w})
}

func (record *AvatarPartRecord) ParseScale() ([]float64, error) {
	return decodeFloatArrayString(record.Scale, 3, []float64{1, 1, 1})
}

func (record *AvatarPartRecord) SetScale(x float64, y float64, z float64) {
	record.Scale = encodeFloatArrayString([]float64{x, y, z})
}

func CreateAvatarPartRecord(avatar int64, template int64, name string, part string, parent string, position string, orientation string, scale string, dbInfo *be.DBInfo) (*AvatarPartRecord, error) {
	record := &AvatarPartRecord{
		UUID:        be.UUID(),
		Avatar:      avatar,
		Name:        name,
		Template:    template,
		Part:        part,
		Parent:      parent,
		Position:    position,
		Orientation: orientation,
		Scale:       scale,
	}
	if record.Position == "" {
		record.Position = "0,0,0"
	}
	if record.Orientation == "" {
		record.Orientation = "0,0,0,1"
	}
	if record.Scale == "" {
		record.Scale = "1,1,1"
	}
	err := dbInfo.Map.Insert(record)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func DeleteAllAvatarPartRecords(dbInfo *be.DBInfo) error {
	records, err := FindAllAvatarPartRecords(dbInfo)
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

func FindAllAvatarPartRecords(dbInfo *be.DBInfo) ([]*AvatarPartRecord, error) {
	var records []*AvatarPartRecord
	_, err := dbInfo.Map.Select(&records, "select * from "+AvatarPartTable+" order by id desc")
	return records, err
}

/*
FindAvatarPartRecordsForAvatar returns a list of part records ordered by parent, so that parts without parents are first in the list
*/
func FindAvatarPartRecordsForAvatar(avatarUUID string, dbInfo *be.DBInfo) ([]*AvatarPartRecord, error) {
	avatar, err := FindAvatarRecord(avatarUUID, dbInfo)
	if err != nil {
		return nil, err
	}
	var records []*AvatarPartRecord
	_, err = dbInfo.Map.Select(&records, "select * from "+AvatarPartTable+" where avatar=$1 order by parent", avatar.Id)
	if err != nil {
		logger.Println("This one", err)
		return nil, err
	}
	return records, err
}

func FindAvatarPartRecord(uuid string, dbInfo *be.DBInfo) (*AvatarPartRecord, error) {
	return FindAvatarPartRecordByField("u_u_i_d", uuid, dbInfo)
}

func FindAvatarPartRecordByField(fieldName string, value string, dbInfo *be.DBInfo) (*AvatarPartRecord, error) {
	record := new(AvatarPartRecord)
	err := dbInfo.Map.SelectOne(record, "select * from "+AvatarPartTable+" where "+fieldName+"=$1", value)
	if err != nil {
		return nil, err
	}
	return record, nil
}

/*
AvatarRecord pulls together a set of Templates (via AvatarPartRecord) that make up an avatar's body parts
*/
type AvatarRecord struct {
	Id   int64  `json:"id" db:"id, primarykey, autoincrement"`
	UUID string `json:"uuid" db:"u_u_i_d"`
	Name string `json:"name" db:"name"` // A human readable name like "Slightly Tipsy Snowman"
}

func CreateAvatarRecord(name string, dbInfo *be.DBInfo) (*AvatarRecord, error) {
	record := &AvatarRecord{
		UUID: be.UUID(),
		Name: name,
	}
	err := dbInfo.Map.Insert(record)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func DeleteAllAvatarRecords(dbInfo *be.DBInfo) error {
	records, err := FindAllAvatarRecords(dbInfo)
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

func FindDefaultAvatarRecord(dbInfo *be.DBInfo) (*AvatarRecord, error) {
	record, err := FindAvatarRecordByField("name", DefaultAvatarName, dbInfo)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func FindAvatarRecord(uuid string, dbInfo *be.DBInfo) (*AvatarRecord, error) {
	return FindAvatarRecordByField("u_u_i_d", uuid, dbInfo)
}

func FindAllAvatarRecords(dbInfo *be.DBInfo) ([]*AvatarRecord, error) {
	var records []*AvatarRecord
	_, err := dbInfo.Map.Select(&records, "select * from "+AvatarTable+" order by id desc")
	return records, err
}

func FindAvatarRecordByField(fieldName string, value string, dbInfo *be.DBInfo) (*AvatarRecord, error) {
	record := new(AvatarRecord)
	err := dbInfo.Map.SelectOne(record, "select * from "+AvatarTable+" where "+fieldName+"=$1", value)
	if err != nil {
		return nil, err
	}
	return record, nil
}

/*
Convert []float{0, 1.5, 2} to "0,1.5,2"
*/
func encodeFloatArrayString(floatArray []float64) string {
	tokens := []string{}
	for _, flt := range floatArray {
		tokens = append(tokens, strconv.FormatFloat(flt, 'f', -1, 64))
	}
	return strings.Join(tokens, ",")
}

/*
Convert "0.5,1,0" to []float64{0.5,1,0}
*/
func decodeFloatArrayString(arrayString string, expectedCount int, defaultValue []float64) ([]float64, error) {
	if arrayString == "" {
		return defaultValue, nil
	}
	tokens := strings.Split(arrayString, ",")
	if len(tokens) != expectedCount {
		return nil, errors.New("Unexpected array string length")
	}
	results := []float64{}
	for _, token := range tokens {
		flt, err := strconv.ParseFloat(token, 64)
		if err != nil {
			return nil, err
		}
		results = append(results, flt)
	}
	return results, nil
}

/*
AvatarPartDescriptor is a JSON serializable description of a part to load into an AvatarRecord described by AvatarDescriptor
It's used when loading avatars from demo_data/avatars/
*/
type AvatarPartDescriptor struct {
	Name         string    `json:"name"`
	TemplateName string    `json:"templateName"`
	Part         string    `json:"part"`
	Parent       string    `json:"parent"`
	Position     []float64 `json:"position"`
	Orientation  []float64 `json:"orientation"`
	Scale        []float64 `json:"scale"`
}

/*
AvatarDescription is a JSON serializable description of an AvatarRecord and its AvatarPartRecords
Used when loading avatars from demo_data/avatars/
*/
type AvatarDescriptor struct {
	Name  string                 `json:"name"`
	Parts []AvatarPartDescriptor `json:"parts"`
}

func DecodeAvatarDescriptor(jsonFile io.Reader) (*AvatarDescriptor, error) {
	result := new(AvatarDescriptor)
	err := json.NewDecoder(jsonFile).Decode(result)
	if err != nil {
		return nil, err
	}
	return result, nil
}
