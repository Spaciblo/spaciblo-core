package db

import (
	"spaciblo.org/be"
)

const FlockMemberTable = "flock_members"

/*
FlockMemberRecord stores a member app of a flock (defined by FlockRecord).
For example, a user might have a FlockMember for editing templates, a FlockMember
for monitoring social media, and a FlockMember that reminds them when it's time to go.
The functionality of a FlockMember (logic, geometry, event handling, etc) is provided by a Template.
*/
type FlockMemberRecord struct {
	Id           int64  `json:"id" db:"id, primarykey, autoincrement"`
	UUID         string `json:"uuid" db:"u_u_i_d"`
	FlockUUID    string `json:"flockUUID" db:"flock_uuid"`
	TemplateUUID string `json:"templateUUID" db:"template_uuid"`
	Position     string `json:"position" db:"position"`       // "0,0,0"
	Orientation  string `json:"orientation" db:"orientation"` // "0,0,0,1"
	Translation  string `json:"translation" db:"translation"` // "0,0,0"
	Rotation     string `json:"rotation" db:"rotation"`       // "0,0,0"
	Scale        string `json:"scale" db:"scale"`             // "1,1,1"
}

func CreateFlockMemberRecord(flockUUID string, templateUUID string, dbInfo *be.DBInfo) (*FlockMemberRecord, error) {
	record := &FlockMemberRecord{
		UUID:         be.UUID(),
		FlockUUID:    flockUUID,
		TemplateUUID: templateUUID,
		Position:     "0,0,0",
		Orientation:  "0,0,0,1",
		Translation:  "0,0,0",
		Rotation:     "0,0,0",
		Scale:        "1,1,1",
	}
	err := dbInfo.Map.Insert(record)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func UpdateFlockMemberRecord(record *FlockMemberRecord, dbInfo *be.DBInfo) error {
	_, err := dbInfo.Map.Update(record)
	return err
}

func DeleteAllFlockMemberRecords(dbInfo *be.DBInfo) error {
	records, err := FindAllFlockMemberRecords(dbInfo)
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

func DeleteFlockMemberRecord(record *FlockMemberRecord, dbInfo *be.DBInfo) error {
	_, err := dbInfo.Map.Delete(record)
	if err != nil {
		return err
	}
	return nil
}

func FindFlockMemberRecord(uuid string, dbInfo *be.DBInfo) (*FlockMemberRecord, error) {
	return findFlockMemberByField("u_u_i_d", uuid, dbInfo)
}

func FindFlockMemberRecords(flockUUID string, offset int, limit int, dbInfo *be.DBInfo) ([]FlockMemberRecord, error) {
	var records []FlockMemberRecord
	_, err := dbInfo.Map.Select(&records, "select * from "+FlockMemberTable+" where flock_uuid=$1 order by id desc limit $2 offset $3", flockUUID, limit, offset)
	return records, err
}

func FindAllFlockMemberRecords(dbInfo *be.DBInfo) ([]*FlockMemberRecord, error) {
	var records []*FlockMemberRecord
	_, err := dbInfo.Map.Select(&records, "select * from "+FlockMemberTable+" order by id desc")
	return records, err
}

func findFlockMemberByField(fieldName string, value string, dbInfo *be.DBInfo) (*FlockMemberRecord, error) {
	record := new(FlockMemberRecord)
	err := dbInfo.Map.SelectOne(record, "select * from "+FlockMemberTable+" where "+fieldName+"=$1", value)
	if err != nil {
		return nil, err
	}
	return record, nil
}
