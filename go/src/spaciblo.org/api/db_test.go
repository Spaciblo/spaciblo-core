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
