package main

/*
	Install demo data to show off the system
*/

import (
	"log"
	"os"

	"spaciblo.org/be"
)

var logger = log.New(os.Stdout, "[demo] ", 0)

func main() {
	dbInfo, err := be.InitDB()
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

	_, err = createUser("alice@example.com", "Alice", "Smith", true, "1234", dbInfo)
	if err != nil {
		return
	}

	_, err = createUser("bob@example.com", "Bob", "Garvey", false, "1234", dbInfo)
	if err != nil {
		return
	}
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
