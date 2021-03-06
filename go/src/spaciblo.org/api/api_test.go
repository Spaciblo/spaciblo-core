package api

import (
	"io/ioutil"
	"os"
	"path"
	"testing"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
	"spaciblo.org/db"

	. "github.com/chai2010/assert"
)

func TestFlockAPI(t *testing.T) {
	err := be.CreateDB()
	AssertNil(t, err)
	dbInfo, err := db.InitDB()
	AssertNil(t, err)
	defer func() {
		be.WipeDB(dbInfo)
		dbInfo.Connection.Close()
	}()

	testApi, err := be.NewTestAPI()
	AssertNil(t, err)
	defer testApi.Stop()
	addApiResources(testApi.API)
	apiDB.MigrateDB(testApi.DBInfo)

	client, err := be.NewClient(testApi.URL())
	AssertNil(t, err)

	be.AssertStatus(t, 401, "GET", testApi.URL()+"/flock/") // Unauthed people should not be able to fetch flocks

	user, err := be.CreateUser("alice@example.com", "Alice", "Example", true, "", dbInfo)
	AssertNil(t, err)
	_, err = be.CreatePassword("1234", user.Id, dbInfo)
	AssertNil(t, err)
	err = client.Authenticate("alice@example.com", "1234")
	AssertNil(t, err)

	list, err := client.GetList("/flock/")
	AssertNil(t, err)
	arr := list.Objects.([]interface{})
	AssertEqual(t, 0, len(arr)) // Alice should be able to list flocks, but have none

	data1 := &apiDB.FlockRecord{Name: "Flock 0"}
	flockRecord1 := &apiDB.FlockRecord{}
	err = client.PostAndReceiveJSON("/flock/", data1, flockRecord1)
	AssertNil(t, err) // Alice should be able to create a flock

	list, err = client.GetList("/flock/")
	AssertNil(t, err)
	arr = list.Objects.([]interface{})
	AssertEqual(t, 1, len(arr)) // Alice should now have a flock in her list of flocks
	flock := arr[0].(map[string]interface{})
	AssertEqual(t, "Flock 0", flock["name"])

	// Get and update the flock
	flockRecord2 := &apiDB.FlockRecord{}
	err = client.GetJSON("/flock/"+flockRecord1.UUID, flockRecord2)
	AssertNil(t, err)
	AssertEqual(t, flockRecord1.UUID, flockRecord2.UUID)
	AssertEqual(t, flockRecord1.Name, flockRecord2.Name)
	flockRecord2.Name = "New Name"
	flockRecord3 := &apiDB.FlockRecord{}
	err = client.PutAndReceiveJSON("/flock/"+flockRecord2.UUID, flockRecord2, flockRecord3)
	AssertNil(t, err)
	AssertEqual(t, flockRecord1.UUID, flockRecord3.UUID)
	AssertEqual(t, "New Name", flockRecord3.Name)

	// Create a new user to test privacy
	client2, err := be.NewClient(testApi.URL())
	AssertNil(t, err)
	user2, err := be.CreateUser("bob@example.com", "Bob", "Example", true, "", dbInfo)
	AssertNil(t, err)
	_, err = be.CreatePassword("1234", user2.Id, dbInfo)
	AssertNil(t, err)
	err = client2.Authenticate("bob@example.com", "1234")
	AssertNil(t, err)

	list, err = client2.GetList("/flock/")
	AssertNil(t, err)
	arr = list.Objects.([]interface{})
	AssertEqual(t, 0, len(arr))                                                          // Bob should not be able to see Alice's flock in their list of flocks
	be.AssertStatus(t, 401, "GET", testApi.URL()+"/flock/"+flockRecord1.UUID+"/member/") // Unauthed people should not be able to fetch flock members

	list, err = client.GetList("/flock/" + flockRecord1.UUID + "/member/")
	AssertNil(t, err)
	arr = list.Objects.([]interface{})
	AssertEqual(t, 0, len(arr)) // There should be no members in this flock, yet

	template1, err := apiDB.CreateTemplateRecord("Template 1", "test.gltf", "", "", "", "", dbInfo)
	AssertNil(t, err)

	data2 := &apiDB.FlockMemberRecord{TemplateUUID: template1.UUID}
	flockMemberRecord1 := &apiDB.FlockMemberRecord{}
	err = client.PostAndReceiveJSON("/flock/"+flockRecord1.UUID+"/member/", data2, flockMemberRecord1)
	AssertNil(t, err)

	list, err = client.GetList("/flock/" + flockRecord1.UUID + "/member/")
	AssertNil(t, err)
	arr = list.Objects.([]interface{})
	AssertEqual(t, 1, len(arr)) // There should be one member in this flock

	// Get the flock member directly
	flockMemberRecord2 := &apiDB.FlockMemberRecord{}
	err = client.GetJSON("/flock-member/"+flockMemberRecord1.UUID, flockMemberRecord2)
	AssertNil(t, err)
	AssertEqual(t, flockMemberRecord1.UUID, flockMemberRecord2.UUID)
	AssertEqual(t, flockMemberRecord1.TemplateUUID, flockMemberRecord2.TemplateUUID)
	AssertEqual(t, "0,0.6,-1", flockMemberRecord2.Position)

	// Update the flock member
	flockMemberRecord2.Position = "1,2,3"
	flockMemberRecord3 := &apiDB.FlockMemberRecord{}
	err = client.PutAndReceiveJSON("/flock-member/"+flockMemberRecord1.UUID, flockMemberRecord2, flockMemberRecord3)
	AssertNil(t, err)
	AssertEqual(t, flockMemberRecord1.UUID, flockMemberRecord3.UUID)
	AssertEqual(t, flockMemberRecord1.TemplateUUID, flockMemberRecord3.TemplateUUID)
	AssertEqual(t, "1,2,3", flockMemberRecord3.Position)

	err = client.Delete("/flock-member/" + flockMemberRecord1.UUID)
	AssertNil(t, err)
}

func TestAvatarAPI(t *testing.T) {
	err := be.CreateDB()
	AssertNil(t, err)
	dbInfo, err := db.InitDB()
	AssertNil(t, err)
	defer func() {
		be.WipeDB(dbInfo)
		dbInfo.Connection.Close()
	}()

	testApi, err := be.NewTestAPI()
	AssertNil(t, err)
	defer testApi.Stop()
	addApiResources(testApi.API)
	apiDB.MigrateDB(testApi.DBInfo)

	client, err := be.NewClient(testApi.URL())
	AssertNil(t, err)
	list, err := client.GetList("/avatar/")
	AssertNil(t, err)
	arr := list.Objects.([]interface{})
	AssertEqual(t, 0, len(arr))

	avatarRecord0, err := apiDB.CreateAvatarRecord("Default Avatar", dbInfo)
	AssertNil(t, err)

	list, err = client.GetList("/avatar/")
	AssertNil(t, err)
	arr = list.Objects.([]interface{})
	AssertEqual(t, 1, len(arr))
	recordMap := arr[0].(map[string]interface{})
	AssertEqual(t, avatarRecord0.UUID, recordMap["uuid"])

	data1 := &apiDB.AvatarRecord{Name: "Avatar 0"}
	avatarRecord1 := &apiDB.AvatarRecord{}
	err = client.PostAndReceiveJSON("/avatar/", data1, avatarRecord1)
	AssertNotNil(t, err)

	user, err := be.CreateUser("alice@example.com", "Alice", "Example", true, "", dbInfo)
	AssertNil(t, err)
	_, err = be.CreatePassword("1234", user.Id, dbInfo)
	AssertNil(t, err)
	err = client.Authenticate("alice@example.com", "1234")
	AssertNil(t, err)

	err = client.PostAndReceiveJSON("/avatar/", data1, avatarRecord1)
	AssertNil(t, err)

	list, err = client.GetList("/avatar/")
	AssertNil(t, err)
	arr = list.Objects.([]interface{})
	AssertEqual(t, 2, len(arr))
	recordMap = arr[0].(map[string]interface{})
	data2 := &apiDB.AvatarRecord{}
	err = client.GetJSON("/avatar/"+recordMap["uuid"].(string), data2)
	AssertNil(t, err)
	AssertEqual(t, recordMap["name"], avatarRecord1.Name)

	avatarRecord1.Name = "Flowers McGee"
	avatarRecord2 := &apiDB.AvatarRecord{}
	err = client.PutAndReceiveJSON("/avatar/"+avatarRecord1.UUID, avatarRecord1, avatarRecord2)
	AssertNil(t, err)
	AssertEqual(t, "Flowers McGee", avatarRecord2.Name)
	err = client.GetJSON("/avatar/"+avatarRecord2.UUID, avatarRecord1)
	AssertNil(t, err)
	AssertEqual(t, "Flowers McGee", avatarRecord1.Name)

	list, err = client.GetList("/avatar/" + avatarRecord1.UUID + "/part/")
	AssertNil(t, err)
	arr = list.Objects.([]interface{})
	AssertEqual(t, 0, len(arr))

	template0, err := apiDB.CreateTemplateRecord("Template 0", "test.gltf", "", "", "", "", dbInfo)
	AssertNil(t, err)

	partData0 := &apiDB.AvatarPartRecord{
		Name:         "Part 0",
		Part:         "tail",
		Parent:       "torso",
		TemplateUUID: template0.UUID,
	}
	avatarPartRecord0 := &apiDB.AvatarPartRecord{}
	err = client.PostAndReceiveJSON("/avatar/"+avatarRecord1.UUID+"/part/", partData0, avatarPartRecord0)
	AssertNil(t, err)
	AssertEqual(t, partData0.Name, avatarPartRecord0.Name)
	AssertEqual(t, partData0.Part, avatarPartRecord0.Part)
	AssertEqual(t, partData0.Parent, avatarPartRecord0.Parent)
	AssertEqual(t, partData0.TemplateUUID, avatarPartRecord0.TemplateUUID)

	list, err = client.GetList("/avatar/" + avatarRecord1.UUID + "/part/")
	AssertNil(t, err)
	arr = list.Objects.([]interface{})
	AssertEqual(t, 1, len(arr))

	avatarPartRecord1 := &apiDB.AvatarPartRecord{}
	err = client.GetJSON("/avatar/"+avatarRecord1.UUID+"/part/"+avatarPartRecord0.UUID, avatarPartRecord1)
	AssertNil(t, err)
	AssertEqual(t, avatarPartRecord0.Name, avatarPartRecord1.Name)
	AssertEqual(t, avatarPartRecord0.Part, avatarPartRecord1.Part)
	AssertEqual(t, avatarPartRecord0.Parent, avatarPartRecord1.Parent)
	AssertEqual(t, avatarPartRecord0.TemplateUUID, avatarPartRecord1.TemplateUUID)

	avatarPartRecord1.Name = "Avasarala"
	avatarPartRecord1.Part = "politician"
	avatarPartRecord1.Parent = "Earth"
	avatarPartRecord2 := &apiDB.AvatarPartRecord{}
	err = client.PutAndReceiveJSON("/avatar/"+avatarRecord1.UUID+"/part/"+avatarPartRecord0.UUID, avatarPartRecord1, avatarPartRecord2)
	AssertNil(t, err)
	AssertEqual(t, avatarPartRecord1.Name, avatarPartRecord2.Name)
	AssertEqual(t, avatarPartRecord1.Part, avatarPartRecord2.Part)
	AssertEqual(t, avatarPartRecord1.Parent, avatarPartRecord2.Parent)
	AssertEqual(t, avatarPartRecord1.TemplateUUID, avatarPartRecord2.TemplateUUID)

	err = client.Delete("/avatar/" + avatarRecord1.UUID + "/part/" + avatarPartRecord0.UUID)
	AssertNil(t, err)

	list, err = client.GetList("/avatar/" + avatarRecord1.UUID + "/part/")
	AssertNil(t, err)
	arr = list.Objects.([]interface{})
	AssertEqual(t, 0, len(arr))

	err = client.PostAndReceiveJSON("/avatar/"+avatarRecord1.UUID+"/part/", avatarPartRecord0, avatarPartRecord1)
	AssertNil(t, err)
	list, err = client.GetList("/avatar/" + avatarRecord1.UUID + "/part/")
	AssertNil(t, err)
	arr = list.Objects.([]interface{})
	AssertEqual(t, 1, len(arr))

	err = client.Delete("/avatar/" + avatarRecord1.UUID)
	AssertNil(t, err)
	list, err = client.GetList("/avatar/")
	AssertNil(t, err)
	arr = list.Objects.([]interface{})
	AssertEqual(t, 1, len(arr))
}

func TestSpaceAPI(t *testing.T) {
	err := be.CreateDB()
	AssertNil(t, err)
	dbInfo, err := db.InitDB()
	AssertNil(t, err)
	defer func() {
		be.WipeDB(dbInfo)
		dbInfo.Connection.Close()
	}()

	testApi, err := be.NewTestAPI()
	AssertNil(t, err)
	defer testApi.Stop()
	addApiResources(testApi.API)
	apiDB.MigrateDB(testApi.DBInfo)

	client, err := be.NewClient(testApi.URL())
	AssertNil(t, err)
	list, err := client.GetList("/space/")
	AssertNil(t, err)
	arr := list.Objects.([]interface{})
	AssertEqual(t, 0, len(arr))

	user, err := be.CreateUser("alice@example.com", "Alice", "Example", true, "", dbInfo)
	AssertNil(t, err)
	_, err = be.CreatePassword("1234", user.Id, dbInfo)
	AssertNil(t, err)
	err = client.Authenticate("alice@example.com", "1234")
	AssertNil(t, err)
	_, err = apiDB.CreateAvatarRecord("Default Avatar", dbInfo)
	AssertNil(t, err)
	templateRecord0, err := apiDB.CreateTemplateRecord("Template 0", "test.gltf", "", "", "", "", dbInfo)
	AssertNil(t, err)

	data0 := &apiDB.SpaceRecord{Name: "Space 0"}
	spaceRecord0 := &apiDB.SpaceRecord{}
	err = client.PostAndReceiveJSON("/space/", data0, spaceRecord0)
	AssertNil(t, err)

	stateNode := apiDB.NewEmptySpaceStateNode()
	stateNode.Settings["name"] = "Space 0"
	stateNode.Nodes = append(stateNode.Nodes, apiDB.NewEmptySpaceStateNode())
	stateNode.Nodes[0].Settings["name"] = "Sub Space 0"
	stateNode.Nodes[0].TemplateUUID = templateRecord0.UUID
	spaceRecord0.State = stateNode.ToString()
	err = apiDB.UpdateSpaceRecord(spaceRecord0, dbInfo)
	AssertNil(t, err)

	list, err = client.GetList("/space/")
	AssertNil(t, err)
	arr = list.Objects.([]interface{})
	AssertEqual(t, 1, len(arr))
	recordMap := arr[0].(map[string]interface{})
	AssertEqual(t, spaceRecord0.UUID, recordMap["uuid"])

	spaceState0 := new(apiDB.SpaceStateNode)
	err = client.GetJSON("/space-state/bogus", spaceState0)
	AssertNotNil(t, err)
	err = client.GetJSON("/space-state/"+spaceRecord0.UUID, spaceState0)
	AssertNil(t, err)
	AssertEqual(t, "Space 0", spaceState0.Settings["name"])
	AssertEqual(t, "Sub Space 0", spaceState0.Nodes[0].Settings["name"])
	AssertEqual(t, stateNode.Nodes[0].TemplateUUID, spaceState0.Nodes[0].TemplateUUID)
	AssertEqual(t, templateRecord0.Name, spaceState0.Nodes[0].TemplateName) // the API should fill this in
}

func TestTemplateAPI(t *testing.T) {
	err := be.CreateDB()
	AssertNil(t, err)
	dbInfo, err := db.InitDB()
	AssertNil(t, err)
	defer func() {
		be.WipeDB(dbInfo)
		dbInfo.Connection.Close()
	}()

	testApi, err := be.NewTestAPI()
	AssertNil(t, err)
	defer testApi.Stop()
	addApiResources(testApi.API)
	apiDB.MigrateDB(testApi.DBInfo)

	tempDir, err := ioutil.TempDir(os.TempDir(), "be-temp")
	AssertNil(t, err, "Could not create tempDir: "+tempDir)
	defer func() {
		err = os.RemoveAll(tempDir)
		AssertNil(t, err, "Could not clean up tempDir: "+tempDir)
	}()

	client, err := be.NewClient(testApi.URL())
	AssertNil(t, err)
	list, err := client.GetList("/template/")
	AssertNil(t, err)
	arr := list.Objects.([]interface{})
	AssertEqual(t, 0, len(arr))

	record0, err := apiDB.CreateTemplateRecord("Template 0", "test.gltf", "", "", "", "", dbInfo)
	AssertNil(t, err)

	list, err = client.GetList("/template/")
	AssertNil(t, err)
	arr = list.Objects.([]interface{})
	AssertEqual(t, 1, len(arr))
	recordMap := arr[0].(map[string]interface{})
	AssertEqual(t, record0.UUID, recordMap["uuid"])

	record1 := new(apiDB.TemplateRecord)
	err = client.GetJSON("/template/"+record0.UUID, record1)
	AssertNil(t, err)
	AssertEqual(t, record0.UUID, record1.UUID)
	AssertEqual(t, record0.Name, record1.Name)

	be.AssertStatus(t, 404, "GET", testApi.URL()+"/template/"+record0.UUID+"/data/"+record0.Geometry)

	data0, err := apiDB.CreateTemplateDataRecord(record0.Id, "odo.gltf", "bogusKey", dbInfo)
	AssertNil(t, err)
	be.AssertStatus(t, 500, "GET", testApi.URL()+"/template/"+record0.UUID+"/data/"+data0.Name)

	file0, err := be.TempFile(tempDir, 10)
	AssertNil(t, err)
	key, err := testApi.API.FileStorage.Put(record0.Geometry, file0)
	AssertNil(t, err)
	_, err = apiDB.CreateTemplateDataRecord(record0.Id, record0.Geometry, key, dbInfo)
	AssertNil(t, err)

	reader, err := client.GetFile("/template/" + record0.UUID + "/data/" + record0.Geometry)
	AssertNil(t, err)
	AssertNotNil(t, reader)

	user1, err := be.CreateUser("bob@example.com", "Bob", "Example", true, "", dbInfo)
	AssertNil(t, err)
	_, err = be.CreatePassword("1234", user1.Id, dbInfo)
	AssertNil(t, err)
	err = client.Authenticate("bob@example.com", "1234")
	AssertNil(t, err)

	// Test that we can read and write template images
	_, err = client.GetFile("/template/" + record0.UUID + "/image")
	AssertNotNil(t, err) // Should 404 because the template has no image

	jpegFile, err := os.Open(path.Join(apiDB.TEST_DATA_DIR, "base64jpeg.txt"))
	AssertNil(t, err)
	base64jpeg, err := ioutil.ReadAll(jpegFile)
	AssertNil(t, err)
	ip := &TemplateImagePost{
		Image: string(base64jpeg),
	}
	_, err = client.PutJSON("/template/"+record0.UUID+"/image", ip)
	AssertNil(t, err)
	reader, err = client.GetFile("/template/" + record0.UUID + "/image")
	AssertNil(t, err)
	AssertNotNil(t, reader)
}
