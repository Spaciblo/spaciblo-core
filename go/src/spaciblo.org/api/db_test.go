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

func TestAvatarRecords(t *testing.T) {
	err := be.CreateDB()
	AssertNil(t, err)
	dbInfo, err := db.InitDB()
	AssertNil(t, err)
	defer func() {
		be.WipeDB(dbInfo)
		dbInfo.Connection.Close()
	}()

	records, err := apiDB.FindAllAvatarRecords(dbInfo)
	AssertNil(t, err)
	AssertEqual(t, 0, len(records))

	avatar1, err := apiDB.CreateAvatarRecord("Captain Janeway", dbInfo)
	AssertNil(t, err)
	AssertNotNil(t, avatar1)
	AssertEqual(t, "Captain Janeway", avatar1.Name)

	headTemplate, err := apiDB.CreateTemplateRecord("Janeway head", "head.obj", "", "", "head", "", dbInfo)
	AssertNil(t, err)
	headPart, err := apiDB.CreateAvatarPartRecord(avatar1.Id, headTemplate.UUID, headTemplate.Name, headTemplate.Part, headTemplate.Parent, "0,1,0", "0,0,0,1", "1,1,1", dbInfo)
	AssertNil(t, err)
	AssertEqual(t, headTemplate.Name, headPart.Name)
	AssertEqual(t, headPart.Position, "0,1,0")
	headPart2, err := apiDB.FindAvatarPartRecord(headPart.UUID, dbInfo)
	AssertNil(t, err)
	AssertEqual(t, headTemplate.Name, headPart2.Name)
	AssertEqual(t, headPart2.Position, "0,1,0")
	parsedPosition, err := headPart2.ParsePosition()
	AssertNil(t, err)
	AssertEqual(t, []float64{0, 1, 0}, parsedPosition)
	headPart2.SetPosition(0.0123, 123.3210, 444)
	AssertEqual(t, "0.0123,123.321,444", headPart2.Position)
	parsedPosition, err = headPart2.ParsePosition()
	AssertNil(t, err)
	AssertEqual(t, []float64{0.0123, 123.321, 444}, parsedPosition)

	hairTemplate, err := apiDB.CreateTemplateRecord("Janeway hair", "hair.obj", "", "", "hair", "head", dbInfo)
	AssertNil(t, err)
	hairPart, err := apiDB.CreateAvatarPartRecord(avatar1.Id, hairTemplate.UUID, hairTemplate.Name, hairTemplate.Part, hairTemplate.Parent, "0,0.1,0", "0,0,0,1", "1,1,1", dbInfo)
	AssertNil(t, err)
	AssertEqual(t, hairTemplate.Name, hairPart.Name)
	AssertEqual(t, hairTemplate.Parent, hairPart.Parent)

	// Test decoding JSON
	filePath := path.Join(apiDB.TEST_DATA_DIR, apiDB.AVATARS_DATA_DIR, "test1.json")
	file, err := os.Open(filePath)
	AssertNil(t, err)
	descriptor, err := apiDB.DecodeAvatarDescriptor(file)
	AssertNil(t, err)
	AssertEqual(t, "Test Avatar", descriptor.Name)
	AssertEqual(t, 5, len(descriptor.Parts))
	AssertEqual(t, []float64{0, 0.6, 0}, descriptor.Parts[0].Position)
	AssertEqual(t, []float64{0.5, 0.5, 0.5}, descriptor.Parts[1].Scale)
}

func TestSpaceStateNode(t *testing.T) {
	testState := func(stateNode *apiDB.SpaceStateNode) {
		AssertEqual(t, "Test Space 1", stateNode.Settings["name"])
		AssertEqual(t, "#DDDDDD", stateNode.Settings["background-color"])
		AssertEqual(t, 3, len(stateNode.Nodes))

		// Test a mostly blank node
		AssertEqual(t, 0, len(stateNode.Nodes[0].Nodes))
		AssertEqual(t, 0, len(stateNode.Nodes[0].Position))
		AssertEqual(t, 0, len(stateNode.Nodes[0].Orientation))
		AssertEqual(t, 0, len(stateNode.Nodes[0].Scale))
		AssertEqual(t, "Box", stateNode.Nodes[0].TemplateName)
		AssertEqual(t, "", stateNode.Nodes[0].TemplateUUID)

		// Test a top level node with all of the attributes
		AssertEqual(t, "Top Level Node", stateNode.Nodes[1].Settings["name"])
		AssertEqual(t, "brown", stateNode.Nodes[1].Settings["foxy"])
		AssertEqual(t, 3, len(stateNode.Nodes[1].Position))
		AssertEqual(t, 4, len(stateNode.Nodes[1].Orientation))
		AssertEqual(t, 3, len(stateNode.Nodes[1].Scale))
		AssertEqual(t, "Box", stateNode.Nodes[1].TemplateName)
		AssertEqual(t, "", stateNode.Nodes[1].TemplateUUID)
		AssertEqual(t, 0, len(stateNode.Nodes[1].Nodes))

		// Test a group node with children
		AssertEqual(t, "Box Group", stateNode.Nodes[2].Settings["name"])
		AssertEqual(t, 3, len(stateNode.Nodes[2].Position))
		AssertEqual(t, 0, len(stateNode.Nodes[2].Orientation))
		AssertEqual(t, 0, len(stateNode.Nodes[2].Scale))
		AssertEqual(t, "", stateNode.Nodes[2].TemplateName)
		AssertEqual(t, "", stateNode.Nodes[2].TemplateUUID)
		AssertEqual(t, 3, len(stateNode.Nodes[2].Nodes))
		// Test a child
		AssertEqual(t, "Box 2", stateNode.Nodes[2].Nodes[1].Settings["name"])
		AssertEqual(t, "made of people", stateNode.Nodes[2].Nodes[1].Settings["soylent"])
		AssertEqual(t, 3, len(stateNode.Nodes[2].Nodes[1].Position))
		AssertEqual(t, 0, len(stateNode.Nodes[2].Nodes[1].Orientation))
		AssertEqual(t, 0, len(stateNode.Nodes[2].Nodes[1].Scale))
		AssertEqual(t, "Box", stateNode.Nodes[2].Nodes[1].TemplateName)
		AssertEqual(t, "", stateNode.Nodes[2].Nodes[1].TemplateUUID)
		AssertEqual(t, 0, len(stateNode.Nodes[2].Nodes[1].Nodes))
	}

	// Test decoding JSON
	filePath := path.Join(apiDB.TEST_DATA_DIR, apiDB.SPACES_DATA_DIR, "TestSpace1", "space.json")
	file, err := os.Open(filePath)
	AssertNil(t, err)
	state, err := apiDB.DecodeSpaceStateNode(file)
	AssertNil(t, err)
	testState(state)

	// Test that we encode equivalent JSON
	buff := bytes.NewBufferString("")
	err = state.Encode(buff)
	AssertNil(t, err)
	state2, err := apiDB.DecodeSpaceStateNode(buff)
	AssertNil(t, err)
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

	spaceRecord, err := apiDB.CreateSpaceRecord("Space 0", "{}", "bogus-avatar-uuid", dbInfo)
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
	spaceRecord3, err := apiDB.CreateSpaceRecord("Space 3", "{}", "bogus-avatar-uuid", dbInfo)
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

	record, err := apiDB.CreateTemplateRecord("Template 0", "test.gltf", "", "", "foo", "bar", dbInfo)
	AssertNil(t, err)
	record2, err := apiDB.FindTemplateRecord(record.UUID, dbInfo)
	AssertNil(t, err)
	AssertEqual(t, record.Id, record2.Id)
	AssertEqual(t, record.UUID, record2.UUID)
	AssertEqual(t, record.Name, record2.Name)
	AssertEqual(t, record.Part, record2.Part)
	AssertEqual(t, record.Parent, record2.Parent)
	_, err = apiDB.FindTemplateRecord("bogusUUID", dbInfo)
	AssertNotNil(t, err)

	records, err = apiDB.FindAllTemplateRecords(dbInfo)
	AssertNil(t, err)
	AssertEqual(t, 1, len(records))
	AssertEqual(t, records[0].UUID, record.UUID)
	record3, err := apiDB.CreateTemplateRecord("Template 3", "test.gltf", "", "", "", "", dbInfo)
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
