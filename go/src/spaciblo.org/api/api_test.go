package api

import (
	"io/ioutil"
	"os"
	"testing"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
	"spaciblo.org/db"

	. "github.com/chai2010/assert"
)

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

	client, err := be.NewClient(testApi.URL())
	AssertNil(t, err)
	list, err := client.GetList("/space/")
	AssertNil(t, err)
	arr := list.Objects.([]interface{})
	AssertEqual(t, 0, len(arr))

	spaceRecord0, err := apiDB.CreateSpaceRecord("Space 0", "{}", "bogus-avatar-uuid", dbInfo)
	AssertNil(t, err)

	list, err = client.GetList("/space/")
	AssertNil(t, err)
	arr = list.Objects.([]interface{})
	AssertEqual(t, 1, len(arr))
	recordMap := arr[0].(map[string]interface{})
	AssertEqual(t, spaceRecord0.UUID, recordMap["uuid"])
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

	record0, err := apiDB.CreateTemplateRecord("Template 0", "test.gltf", dbInfo)
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

	be.AssertStatus(t, 404, "GET", testApi.URL()+"/template/"+record0.UUID+"/data/"+record0.Source)

	data0, err := apiDB.CreateTemplateDataRecord(record0.Id, "odo.gltf", "bogusKey", dbInfo)
	AssertNil(t, err)
	be.AssertStatus(t, 500, "GET", testApi.URL()+"/template/"+record0.UUID+"/data/"+data0.Name)

	file0, err := be.TempFile(tempDir, 10)
	AssertNil(t, err)
	key, err := testApi.API.FileStorage.Put(record0.Source, file0)
	AssertNil(t, err)
	_, err = apiDB.CreateTemplateDataRecord(record0.Id, record0.Source, key, dbInfo)
	AssertNil(t, err)

	reader, err := client.GetFile("/template/" + record0.UUID + "/data/" + record0.Source)
	AssertNil(t, err)
	AssertNotNil(t, reader)

}
