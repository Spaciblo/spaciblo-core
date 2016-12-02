package api

import (
	"testing"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
	"spaciblo.org/db"

	. "github.com/chai2010/assert"
)

func TestAPI(t *testing.T) {
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

	spaceRecord0, err := apiDB.CreateSpaceRecord("Space 0", dbInfo)
	AssertNil(t, err)

	list, err = client.GetList("/space/")
	AssertNil(t, err)
	arr = list.Objects.([]interface{})
	AssertEqual(t, 1, len(arr))
	recordMap := arr[0].(map[string]interface{})
	AssertEqual(t, spaceRecord0.UUID, recordMap["uuid"])
}
