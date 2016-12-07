package api

import (
	"testing"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
	"spaciblo.org/db"

	. "github.com/chai2010/assert"
)

func TestSpaceRecords(t *testing.T) {
	err := be.CreateDB()
	AssertNil(t, err)
	dbInfo, err := db.InitDB()
	AssertNil(t, err)
	defer func() {
		be.WipeDB(dbInfo)
		dbInfo.Connection.Close()
	}()

	spaceRecords, err := apiDB.FindAllSpaceRecords(dbInfo)
	AssertNil(t, err)
	AssertEqual(t, 0, len(spaceRecords))

	spaceRecord, err := apiDB.CreateSpaceRecord("Space 0", dbInfo)
	AssertNil(t, err)
	spaceRecord2, err := apiDB.FindSpaceRecord(spaceRecord.UUID, dbInfo)
	AssertNil(t, err)
	AssertEqual(t, spaceRecord.Id, spaceRecord2.Id)
	AssertEqual(t, spaceRecord.UUID, spaceRecord2.UUID)
	AssertEqual(t, spaceRecord.Name, spaceRecord2.Name)
	_, err = apiDB.FindSpaceRecord("bogusUUID", dbInfo)
	AssertNotNil(t, err)

	spaceRecords, err = apiDB.FindAllSpaceRecords(dbInfo)
	AssertNil(t, err)
	AssertEqual(t, 1, len(spaceRecords))
	AssertEqual(t, spaceRecords[0].UUID, spaceRecord.UUID)
	spaceRecord3, err := apiDB.CreateSpaceRecord("Space 3", dbInfo)
	AssertNil(t, err)
	spaceRecords, err = apiDB.FindAllSpaceRecords(dbInfo)
	AssertNil(t, err)
	AssertEqual(t, 2, len(spaceRecords))
	AssertEqual(t, spaceRecords[0].UUID, spaceRecord3.UUID)
	AssertEqual(t, spaceRecords[1].UUID, spaceRecord.UUID)
}

func TestTemplateRecords(t *testing.T) {
	err := be.CreateDB()
	AssertNil(t, err)
	dbInfo, err := db.InitDB()
	AssertNil(t, err)
	defer func() {
		be.WipeDB(dbInfo)
		dbInfo.Connection.Close()
	}()

	records, err := apiDB.FindAllTemplateRecords(dbInfo)
	AssertNil(t, err)
	AssertEqual(t, 0, len(records))

	record, err := apiDB.CreateTemplateRecord("Template 0", "test.gltf", dbInfo)
	AssertNil(t, err)
	record2, err := apiDB.FindTemplateRecord(record.UUID, dbInfo)
	AssertNil(t, err)
	AssertEqual(t, record.Id, record2.Id)
	AssertEqual(t, record.UUID, record2.UUID)
	AssertEqual(t, record.Name, record2.Name)
	_, err = apiDB.FindTemplateRecord("bogusUUID", dbInfo)
	AssertNotNil(t, err)

	records, err = apiDB.FindAllTemplateRecords(dbInfo)
	AssertNil(t, err)
	AssertEqual(t, 1, len(records))
	AssertEqual(t, records[0].UUID, record.UUID)
	record3, err := apiDB.CreateTemplateRecord("Template 3", "test.gltf", dbInfo)
	AssertNil(t, err)
	records, err = apiDB.FindAllTemplateRecords(dbInfo)
	AssertNil(t, err)
	AssertEqual(t, 2, len(records))
	AssertEqual(t, records[0].UUID, record3.UUID)
	AssertEqual(t, records[1].UUID, record.UUID)

	dataRecords, err := apiDB.FindAllTemplateDataRecords(dbInfo)
	AssertNil(t, err)
	AssertEqual(t, 0, len(dataRecords))

	data1, err := apiDB.CreateTemplateDataRecord(record.Id, "test.gltf", "key1234", dbInfo)
	AssertNil(t, err)
	data2, err := apiDB.FindTemplateDataRecord(data1.Template, "bogus name", dbInfo)
	AssertNotNil(t, err)
	data2, err = apiDB.FindTemplateDataRecord(data1.Template, "test.gltf", dbInfo)
	AssertNil(t, err)
	AssertEqual(t, data1.Id, data2.Id)
}
