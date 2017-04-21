/*
Create and manage user accounts.
*/
package main

import (
	"bufio"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"

	"spaciblo.org/be"
	"spaciblo.org/db"
)

var logger = log.New(os.Stdout, "[users] ", 0)

func main() {
	dbInfo, err := db.InitDB()
	if err != nil {
		logger.Panic("DB Initialization Error: " + err.Error())
		return
	}
	if len(os.Args) <= 1 {
		return
	}
	if os.Args[1] == "create" {
		vals := promptForUserInfo()
		_, err := createUser(
			vals[0],
			vals[1],
			vals[2],
			vals[3] == "t" || vals[3] == "true",
			vals[4],
			"",
			dbInfo,
		)
		if err != nil {
			logger.Println("Error:", err)
		}
	} else if os.Args[1] == "password" {
		vals := promptForPassword()
		err := changePassword(
			vals[0],
			vals[1],
			dbInfo,
		)
		if err != nil {
			logger.Println("Error:", err)
		}
	} else {
		logger.Println("unknown command:", os.Args[1])
	}
}

func promptForUserInfo() []string {
	return []string{
		promptFor("email"),
		promptFor("first name"),
		promptFor("last name"),
		promptFor("staff"),
		promptFor("password"),
	}
}

func promptForPassword() []string {
	return []string{
		promptFor("email"),
		promptFor("password"),
	}
}

func promptFor(value string) string {
	fmt.Print(value + ": ")
	reader := bufio.NewReader(os.Stdin)
	val, _ := reader.ReadString('\n')
	return strings.TrimSpace(val)
}

func changePassword(email string, password string, dbInfo *be.DBInfo) error {
	user, err := be.FindUserByEmail(email, dbInfo)
	if err != nil {
		return err
	}
	passwordRecord, err := be.FindPasswordByUserId(user.Id, dbInfo)
	if err != nil {
		return err
	}
	err = passwordRecord.Encode(password)
	if err != nil {
		return err
	}
	return be.UpdatePassword(passwordRecord, dbInfo)
}

func createUser(email string, firstName string, lastName string, staff bool, password string, avatarUUID string, dbInfo *be.DBInfo) (*be.User, error) {
	_, err := be.FindUserByEmail(email, dbInfo)
	if err == nil {
		return nil, errors.New("User with that email already exists")
	}
	user, err := be.CreateUser(email, firstName, lastName, staff, avatarUUID, dbInfo)
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
