package api

import (
	"bytes"
	"flag"
	"os"
	"path"
	"testing"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
	"spaciblo.org/db"

	. "github.com/chai2010/assert"
)

var (
	CWD = flag.String("cwd", "", "set cwd") // Sets the current working directory because otherwise the testing CWD is wherever go test puts the test binary
)

func init() {
	flag.Parse()
	if *CWD != "" {
		if err := os.Chdir(*CWD); err != nil {
			logger.Println("Chdir error", err)
		}
	}
}

func TestSpaceStateFile(t *testing.T) {
	filePath := path.Join(apiDB.TEST_DATA_DIR, apiDB.SPACES_DATA_DIR, "TestSpace1", "space.json")
	file, err := os.Open(filePath)
	AssertNil(t, err)

	testState := func(stateFile *apiDB.SpaceStateFile) {
		AssertNil(t, err)
		AssertEqual(t, "Test Space 1", stateFile.Name)
		AssertEqual(t, "#DDDDDD", stateFile.Settings["background-color"])
		AssertEqual(t, 3, len(stateFile.Nodes))

		// Test a mostly blank node
		AssertEqual(t, 0, len(stateFile.Nodes[0].Name))
		AssertEqual(t, 0, len(stateFile.Nodes[0].Nodes))
		AssertEqual(t, 0, len(stateFile.Nodes[0].Position))
		AssertEqual(t, 0, len(stateFile.Nodes[0].Rotation))
		AssertEqual(t, 0, len(stateFile.Nodes[0].Scale))
		AssertEqual(t, "Box", stateFile.Nodes[0].TemplateName)
		AssertEqual(t, "", stateFile.Nodes[0].TemplateUUID)

		// Test a top level node with all of the attributes
		AssertEqual(t, "Top Level Node", stateFile.Nodes[1].Name)
		AssertEqual(t, "brown", stateFile.Nodes[1].Settings["foxy"])
		AssertEqual(t, 3, len(stateFile.Nodes[1].Position))
		AssertEqual(t, 3, len(stateFile.Nodes[1].Rotation))
		AssertEqual(t, 3, len(stateFile.Nodes[1].Scale))
		AssertEqual(t, "Box", stateFile.Nodes[1].TemplateName)
		AssertEqual(t, "", stateFile.Nodes[1].TemplateUUID)
		AssertEqual(t, 0, len(stateFile.Nodes[1].Nodes))

		// Test a group node with children
		AssertEqual(t, "Box Group", stateFile.Nodes[2].Name)
		AssertEqual(t, 3, len(stateFile.Nodes[2].Position))
		AssertEqual(t, 0, len(stateFile.Nodes[2].Rotation))
		AssertEqual(t, 0, len(stateFile.Nodes[2].Scale))
		AssertEqual(t, "", stateFile.Nodes[2].TemplateName)
		AssertEqual(t, "", stateFile.Nodes[2].TemplateUUID)
		AssertEqual(t, 3, len(stateFile.Nodes[2].Nodes))
		// Test a child
		AssertEqual(t, "Box 2", stateFile.Nodes[2].Nodes[1].Name)
		AssertEqual(t, "made of people", stateFile.Nodes[2].Nodes[1].Settings["soylent"])
		AssertEqual(t, 3, len(stateFile.Nodes[2].Nodes[1].Position))
		AssertEqual(t, 0, len(stateFile.Nodes[2].Nodes[1].Rotation))
		AssertEqual(t, 0, len(stateFile.Nodes[2].Nodes[1].Scale))
		AssertEqual(t, "Box", stateFile.Nodes[2].Nodes[1].TemplateName)
		AssertEqual(t, "", stateFile.Nodes[2].Nodes[1].TemplateUUID)
		AssertEqual(t, 0, len(stateFile.Nodes[2].Nodes[1].Nodes))
	}

	// Test decoding JSON
	state, err := apiDB.DecodeSpaceStateFile(file)
	testState(state)

	// Test that we encode equivalent JSON
	buff := bytes.NewBufferString("")
	err = state.Encode(buff)
	AssertNil(t, err)
	state2, err := apiDB.DecodeSpaceStateFile(buff)
	testState(state2)
}

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
