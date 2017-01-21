package db

import (
	"errors"
	"strconv"

	"spaciblo.org/be"
)

const TemplateDataTable = "template_data"

type TemplateDataRecord struct {
	Id       int64  `json:"id" db:"id, primarykey, autoincrement"`
	Template int64  `json:"template" db:"template"` // TODO make Template a foreign key
	Name     string `json:"name" db:"name"`         // TODO make Template and Name unique together
	Key      string `json:"-" db:"key"`             // The FileStorage key for this data
}

func CreateTemplateDataRecord(template int64, name string, key string, dbInfo *be.DBInfo) (*TemplateDataRecord, error) {
	_, err := FindTemplateDataRecordByTemplateId(template, name, dbInfo)
	if err == nil {
		return nil, errors.New("A template already exists with that template ID and name: " + strconv.FormatInt(template, 10) + "/" + name)
	}
	record := &TemplateDataRecord{
		Template: template,
		Name:     name,
		Key:      key,
	}
	err = dbInfo.Map.Insert(record)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func UpdateTemplateDataRecord(record *TemplateDataRecord, dbInfo *be.DBInfo) error {
	_, err := dbInfo.Map.Update(record)
	return err
}

func DeleteTemplateDataRecord(id int64, dbInfo *be.DBInfo) error {
	record := new(TemplateDataRecord)
	err := dbInfo.Map.SelectOne(record, "select * from "+TemplateDataTable+" where id=$1", id)
	if err == nil {
		_, err = dbInfo.Map.Delete(record)
		if err != nil {
			return err
		}
	}
	return nil // returns nil on not finding the record or on deleting it
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

func FindTemplateDataRecordByTemplateId(id int64, name string, dbInfo *be.DBInfo) (*TemplateDataRecord, error) {
	record := new(TemplateDataRecord)
	err := dbInfo.Map.SelectOne(record, "select * from "+TemplateDataTable+" where id=$1 and name=$2", id, name)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func FindTemplateDataRecords(template int64, offset int, limit int, dbInfo *be.DBInfo) ([]*TemplateDataRecord, error) {
	var records []*TemplateDataRecord
	if limit > -1 {
		_, err := dbInfo.Map.Select(&records, "select * from "+TemplateDataTable+" where template=$1 order by id desc limit $2 offset $3", template, limit, offset)
		return records, err
	} else {
		_, err := dbInfo.Map.Select(&records, "select * from "+TemplateDataTable+" where template=$1 order by id desc offset $2", template, offset)
		return records, err
	}
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
