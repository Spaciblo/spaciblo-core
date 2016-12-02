package main

/*
	Install demo data to show off the system
*/

import (
	"log"
	"os"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
	"spaciblo.org/db"
)

var logger = log.New(os.Stdout, "[demo] ", 0)

func main() {
	dbInfo, err := db.InitDB()
	if err != nil {
		logger.Panic("DB Initialization Error: " + err.Error())
		return
	}

	err = be.DeleteAllPasswords(dbInfo)
	if err != nil {
		logger.Fatal("Could not delete passwords: ", err)
		return
	}
	err = be.DeleteAllUsers(dbInfo)
	if err != nil {
		logger.Fatal("Could not delete users: ", err)
		return
	}
	err = apiDB.DeleteAllSpaceRecords(dbInfo)
	if err != nil {
		logger.Fatal("Could not delete space records: ", err)
		return
	}

	createSpaceRecord("Space 0", dbInfo)
	createSpaceRecord("Space 1", dbInfo)
	createSpaceRecord("Space 2", dbInfo)

	createUser("alice@example.com", "Alice", "Smith", true, "1234", dbInfo)
	createUser("bob@example.com", "Bob", "Garvey", false, "1234", dbInfo)
}

func createSpaceRecord(name string, dbInfo *be.DBInfo) (*apiDB.SpaceRecord, error) {
	record, err := apiDB.CreateSpaceRecord(name, dbInfo)
	if err != nil {
		logger.Fatal("Could not create user", err)
		return nil, err
	}
	return record, nil
}

func createUser(email string, firstName string, lastName string, staff bool, password string, dbInfo *be.DBInfo) (*be.User, error) {
	user, err := be.CreateUser(email, firstName, lastName, staff, dbInfo)
	if err != nil {
		logger.Fatal("Could not create user", err)
		return nil, err
	}
	_, err = be.CreatePassword(password, user.Id, dbInfo)
	if err != nil {
		logger.Fatal("Could not create password", err)
		return nil, err
	}
	return user, nil
}
