package db

import (
	"spaciblo.org/be"
)

const TemplateDataTable = "template_data"

type TemplateDataRecord struct {
	Id       int64  `json:"id" db:"id, primarykey, autoincrement"`
	Template int64  `json:"template" db:"template"` // TODO make Template a foreign key
	Name     string `json:"name" db:"name"`         // TODO make Template and Name unique together
	Key      string `json:"-" db:"key"`
}

func CreateTemplateDataRecord(template int64, name string, key string, dbInfo *be.DBInfo) (*TemplateDataRecord, error) {
	record := &TemplateDataRecord{
		Template: template,
		Name:     name,
		Key:      key,
	}
	err := dbInfo.Map.Insert(record)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func DeleteAllTemplateDataRecords(dbInfo *be.DBInfo) error {
	records, err := FindAllTemplateDataRecords(dbInfo)
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

func FindTemplateDataRecord(template int64, name string, dbInfo *be.DBInfo) (*TemplateDataRecord, error) {
	record := new(TemplateDataRecord)
	err := dbInfo.Map.SelectOne(record, "select * from "+TemplateDataTable+" where template=$1 and name=$2", template, name)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func FindTemplateDataRecords(template int64, offset int, limit int, dbInfo *be.DBInfo) ([]TemplateDataRecord, error) {
	var records []TemplateDataRecord
	_, err := dbInfo.Map.Select(&records, "select * from "+TemplateDataTable+" where template=$1 order by id desc limit $2 offset $3", template, limit, offset)
	return records, err
}

func FindAllTemplateDataRecords(dbInfo *be.DBInfo) ([]*TemplateDataRecord, error) {
	var records []*TemplateDataRecord
	_, err := dbInfo.Map.Select(&records, "select * from "+TemplateDataTable+" order by id desc")
	return records, err
}

func findTemplateDataByField(fieldName string, value string, dbInfo *be.DBInfo) (*TemplateDataRecord, error) {
	record := new(TemplateDataRecord)
	err := dbInfo.Map.SelectOne(record, "select * from "+TemplateDataTable+" where "+fieldName+"=$1", value)
	if err != nil {
		return nil, err
	}
	return record, nil
}
