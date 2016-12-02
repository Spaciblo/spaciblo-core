package db

import (
	"spaciblo.org/be"
)

const SpaceTable = "spaces"

type SpaceRecord struct {
	Id   int64  `json:"id" db:"id, primarykey, autoincrement"`
	UUID string `json:"uuid" db:"u_u_i_d"`
	Name string `json:"name" db:"name"`
}

func CreateSpaceRecord(name string, dbInfo *be.DBInfo) (*SpaceRecord, error) {
	record := &SpaceRecord{
		Name: name,
		UUID: be.UUID(),
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
