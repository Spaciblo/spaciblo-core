package db

import (
	"spaciblo.org/be"
)

const FlockTable = "flocks"

/*
FlockRecord stores a reference to a set of FlockMemberRecords that make up a user's in-world dashboard, of sorts.
For example, a user might have a FlockMember for editing templates, a FlockMember for monitoring news,
and a FlockMember that reminds them when it's time to go.

A user's flock is invisible to other users, is client side only, and not replicated through the backend.
*/
type FlockRecord struct {
	Id       int64  `json:"id" db:"id, primarykey, autoincrement"`
	UUID     string `json:"uuid" db:"u_u_i_d"`
	Name     string `json:"name" db:"name"`
	Active   bool   `json:"active" db:"active"`
	UserUUID string `json:"userUUID" db:"user_uuid"`
}

func CreateFlockRecord(name string, userUUID string, dbInfo *be.DBInfo) (*FlockRecord, error) {
	record := &FlockRecord{
		UUID:     be.UUID(),
		Name:     name,
		UserUUID: userUUID,
		Active:   false,
	}
	err := dbInfo.Map.Insert(record)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func UpdateFlockRecord(record *FlockRecord, dbInfo *be.DBInfo) error {
	_, err := dbInfo.Map.Update(record)
	return err
}

func DeleteFlockRecord(record *FlockRecord, dbInfo *be.DBInfo) error {
	_, err := dbInfo.Map.Delete(record)
	if err != nil {
		return err
	}
	return nil
}

func DeleteAllFlockRecords(dbInfo *be.DBInfo) error {
	records, err := FindAllFlockRecords(dbInfo)
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

func FindFlockRecord(uuid string, dbInfo *be.DBInfo) (*FlockRecord, error) {
	return findFlockByField("u_u_i_d", uuid, dbInfo)
}

func FindFlockRecords(userUUID string, offset int, limit int, dbInfo *be.DBInfo) ([]*FlockRecord, error) {
	var records []*FlockRecord
	_, err := dbInfo.Map.Select(&records, "select * from "+FlockTable+" where user_uuid=$1 order by id desc limit $2 offset $3", userUUID, limit, offset)
	return records, err
}

func FindAllFlockRecords(dbInfo *be.DBInfo) ([]*FlockRecord, error) {
	var records []*FlockRecord
	_, err := dbInfo.Map.Select(&records, "select * from "+FlockTable+" order by id desc")
	return records, err
}

func findFlockByField(fieldName string, value string, dbInfo *be.DBInfo) (*FlockRecord, error) {
	record := new(FlockRecord)
	err := dbInfo.Map.SelectOne(record, "select * from "+FlockTable+" where "+fieldName+"=$1", value)
	if err != nil {
		return nil, err
	}
	return record, nil
}
