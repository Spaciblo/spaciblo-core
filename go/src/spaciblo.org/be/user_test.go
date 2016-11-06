package be

import (
	"os"
	"testing"

	"github.com/Spaciblo/qbs"
	. "github.com/chai2010/assert"
)

func TestUserAPI(t *testing.T) {
	CreateAndInitDB()
	db, err := qbs.GetQbs()
	AssertNil(t, err)
	defer func() {
		WipeDB()
		db.Close()
	}()

	testApi, err := NewTestAPI()
	AssertNil(t, err)
	defer testApi.Stop()

	users, err := FindUsers(0, 100, db)
	AssertNil(t, err)
	AssertEqual(t, 0, len(users), "Need to have 0 users when starting")

	user, err := CreateUser("adrian@monk.example.com", "Adrian", "Monk", false, db)
	AssertNil(t, err)
	_, err = CreatePassword("1234", user.Id, db)
	AssertNil(t, err)
	staff, err := CreateUser("sherona@monk.example.com", "Sherona", "Smith", true, db)
	AssertNil(t, err)
	_, err = CreatePassword("1234", staff.Id, db)
	AssertNil(t, err)

	AssertStatus(t, 401, "GET", testApi.URL()+"/user/")
	AssertStatus(t, 401, "GET", testApi.URL()+"/user/"+user.UUID)

	userClient, err := NewClient(testApi.URL())
	AssertNil(t, err)
	user2 := new(User)
	err = userClient.GetJSON("/user/current", user2)
	AssertNotNil(t, err, "Unauthenticated fetch")
	reader, err := userClient.GetFile("/user/current/image")
	AssertNotNil(t, err)
	err = userClient.Authenticate(user.Email, "")
	AssertNotNil(t, err, "Should have failed with empty password")
	err = userClient.Authenticate("", "1234")
	AssertNotNil(t, err, "Should have failed with empty email")
	err = userClient.Authenticate("", "")
	AssertNotNil(t, err, "Should have failed with empty login info")
	err = userClient.Authenticate(user.Email, "4321")
	AssertNotNil(t, err, "Should have failed with incorrect password")
	err = userClient.Authenticate(user.Email, "1234")
	AssertNil(t, err, "Should have authenticated with proper email and username")

	err = userClient.GetJSON("/user/current", user2)
	AssertNil(t, err, "Error fetching current user")
	AssertEqual(t, user.Id, user2.Id)
	_, err = userClient.GetList("/user/")
	AssertNotNil(t, err, "Users API should be staff only")
	err = userClient.GetJSON("/user/"+user2.UUID, user2)
	AssertNotNil(t, err, "User API should be staff only")
	AssertEqual(t, "", user2.Image)
	imageFile1, err := TempImage(os.TempDir(), 1000, 1000)
	AssertNil(t, err)
	err = userClient.UpdateUserImage(imageFile1)
	AssertNil(t, err)
	err = userClient.GetJSON("/user/current", user2)
	AssertNil(t, err)
	Assert(t, user2.Image != "", "User.Image should not be empty")
	reader, err = userClient.GetFile("/user/current/image")
	AssertNil(t, err)
	AssertNotNil(t, reader)

	staffClient, err := NewClient(testApi.URL())
	AssertNil(t, err)
	err = staffClient.Authenticate(staff.Email, "1234")
	AssertNil(t, err)
	err = staffClient.GetJSON("/user/"+user2.UUID, user2)
	AssertNil(t, err, "API should be readable by staff")
	AssertEqual(t, user.Id, user2.Id)

	list, err := staffClient.GetList("/user/")
	AssertNil(t, err)
	arr := list.Objects.([]interface{})
	AssertEqual(t, 2, len(arr))

	// Test that staff can update a User
	staff2 := new(User)
	err = staffClient.GetJSON("/user/current", staff2)
	AssertNil(t, err)
	staff2.FirstName = "Pickles"
	staff2.LastName = "McGee"
	err = staffClient.UpdateUser(staff2)
	AssertNil(t, err)
	AssertEqual(t, staff2.FirstName, "Pickles")
	AssertEqual(t, staff2.LastName, "McGee")
	staff3 := new(User)
	err = staffClient.GetJSON("/user/current", staff3)
	AssertNil(t, err)
	AssertEqual(t, staff2.FirstName, staff3.FirstName)
	AssertEqual(t, staff2.LastName, staff3.LastName)

	err = userClient.Deauthenticate()
	AssertNil(t, err)
	err = staffClient.Deauthenticate()
	AssertNil(t, err)
	err = staffClient.Deauthenticate()
	AssertNil(t, err)
}

func TestUser(t *testing.T) {
	CreateAndInitDB()
	db, err := qbs.GetQbs()
	AssertNil(t, err)
	defer func() {
		WipeDB()
		db.Close()
	}()

	user, err := CreateUser("adrian@monk.example.com", "Adrian", "Monk", false, db)
	AssertNil(t, err)
	AssertNotEqual(t, user.UUID, "")

	_, err = FindUser("not-a-uuid", db)
	AssertNotNil(t, err)

	user2, err := FindUser(user.UUID, db)
	AssertNil(t, err)
	AssertEqual(t, user2.UUID, user.UUID)
	AssertEqual(t, user2.Email, user.Email)

	user2.Email = "crosby@bing.example.com"
	err = UpdateUser(user2, db)
	AssertNil(t, err)
	AssertEqual(t, user2.UUID, user.UUID)
	user3, err := FindUser(user2.UUID, db)
	AssertNil(t, err)
	AssertEqual(t, user2.Email, user3.Email)
}
