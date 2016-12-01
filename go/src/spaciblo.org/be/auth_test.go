package be

import (
	"testing"

	. "github.com/chai2010/assert"
)

func TestPassword(t *testing.T) {
	err := CreateDB()
	AssertNil(t, err)
	dbInfo, err := InitDB()
	AssertNil(t, err)
	defer func() {
		WipeDB(dbInfo)
		dbInfo.Connection.Close()
	}()

	user, err := CreateUser("adrian123@monk.example.com", "Adrian", "Monk", false, dbInfo)
	AssertNil(t, err)

	plaintext1 := "ho ho ho"
	password, err := CreatePassword(plaintext1, user.Id, dbInfo)
	AssertNil(t, err)
	Assert(t, password.Matches(plaintext1))
	Assert(t, PasswordMatches(user.Id, plaintext1, dbInfo))
	AssertFalse(t, PasswordMatches(user.Id, "smooth move, sherlock", dbInfo))
	AssertFalse(t, password.Matches("oi oi oi"))
	AssertFalse(t, password.Matches(""))

	password2, err := FindPasswordByUserId(user.Id, dbInfo)
	AssertNil(t, err)
	AssertEqual(t, password.Hash, password2.Hash)
	Assert(t, password2.Matches(plaintext1))

	// plaintext
	plaintext2 := "seekret"
	password2.Encode(plaintext2)
	err = UpdatePassword(password2, dbInfo)
	AssertNil(t, err)
}

func TestUUID(t *testing.T) {
	// Test the stuff
	// TODO actually test this
	AssertNotEqual(t, UUID(), UUID())
}
