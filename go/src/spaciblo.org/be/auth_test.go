package be

import (
	"testing"

	"github.com/Spaciblo/qbs"
	. "github.com/chai2010/assert"
)

func TestPassword(t *testing.T) {
	CreateAndInitDB()
	db, err := qbs.GetQbs()
	AssertNil(t, err)
	defer func() {
		WipeDB()
		db.Close()
	}()

	user, err := CreateUser("adrian123@monk.example.com", "Adrian", "Monk", false, db)
	AssertNil(t, err)

	plaintext1 := "ho ho ho"
	password, err := CreatePassword(plaintext1, user.Id, db)
	AssertNil(t, err)
	Assert(t, password.Matches(plaintext1))
	Assert(t, PasswordMatches(user.Id, plaintext1, db))
	AssertFalse(t, PasswordMatches(user.Id, "smooth move, sherlock", db))
	AssertFalse(t, password.Matches("oi oi oi"))
	AssertFalse(t, password.Matches(""))

	password2, err := FindPasswordByUserId(user.Id, db)
	AssertNil(t, err)
	AssertEqual(t, password.Hash, password2.Hash)
	Assert(t, password2.Matches(plaintext1))

	// plaintext
	plaintext2 := "seekret"
	password2.Encode(plaintext2)
	err = UpdatePassword(password2, db)
	AssertNil(t, err)
}

func TestUUID(t *testing.T) {
	// Test the stuff
	// TODO actually test this
	AssertNotEqual(t, UUID(), UUID())
}
