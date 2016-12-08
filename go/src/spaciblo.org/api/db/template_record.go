package db

import (
	"spaciblo.org/be"
)

const TemplateTable = "templates"

type TemplateRecord struct {
	Id     int64  `json:"id" db:"id, primarykey, autoincrement"`
	UUID   string `json:"uuid" db:"u_u_i_d"` // TODO make unique
	Name   string `json:"name" db:"name"`
	Source string `json:"source" db:"source"` // TODO make not null
}

func CreateTemplateRecord(name string, source string, dbInfo *be.DBInfo) (*TemplateRecord, error) {
	record := &TemplateRecord{
		Name:   name,
		UUID:   be.UUID(),
		Source: source,
	}
	err := dbInfo.Map.Insert(record)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func DeleteAllTemplateRecords(dbInfo *be.DBInfo) error {
	records, err := FindAllTemplateRecords(dbInfo)
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

func FindTemplateRecord(uuid string, dbInfo *be.DBInfo) (*TemplateRecord, error) {
	return FindTemplateRecordByField("u_u_i_d", uuid, dbInfo)
}

func FindTemplateRecords(offset int, limit int, dbInfo *be.DBInfo) ([]TemplateRecord, error) {
	var records []TemplateRecord
	_, err := dbInfo.Map.Select(&records, "select * from "+TemplateTable+" order by id desc limit $1 offset $2", limit, offset)
	return records, err
}

func FindAllTemplateRecords(dbInfo *be.DBInfo) ([]*TemplateRecord, error) {
	var records []*TemplateRecord
	_, err := dbInfo.Map.Select(&records, "select * from "+TemplateTable+" order by id desc")
	return records, err
}

func FindTemplateRecordByField(fieldName string, value string, dbInfo *be.DBInfo) (*TemplateRecord, error) {
	record := new(TemplateRecord)
	err := dbInfo.Map.SelectOne(record, "select * from "+TemplateTable+" where "+fieldName+"=$1", value)
	if err != nil {
		return nil, err
	}
	return record, nil
}
