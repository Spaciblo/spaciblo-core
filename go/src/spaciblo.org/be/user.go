package be

import (
	"time"

	"github.com/Spaciblo/qbs"
)

type User struct {
	Id        int64     `json:"id" qbs:"pk"`
	UUID      string    `json:"uuid" qbs:"unique,index"`
	Email     string    `json:"email"`
	FirstName string    `json:"first-name"`
	LastName  string    `json:"last-name"`
	Staff     bool      `json:"staff"`
	Image     string    `json:"image"`
	Created   time.Time `json:"created"`
	Updated   time.Time `json:"updated"`
}

func CreateUser(email string, firstName string, lastName string, staff bool, db *qbs.Qbs) (*User, error) {
	user := new(User)
	user.UUID = UUID()
	user.Email = email
	user.FirstName = firstName
	user.LastName = lastName
	user.Staff = staff
	_, err := db.Save(user)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func UpdateUser(user *User, db *qbs.Qbs) error {
	_, err := db.Save(user)
	if err != nil {
		return err
	}
	return nil
}

func FindUsers(offset int, limit int, q *qbs.Qbs) ([]*User, error) {
	var users []*User
	err := q.Limit(limit).Offset(offset).FindAll(&users)
	return users, err
}

func FindUser(uuid string, db *qbs.Qbs) (*User, error) {
	return findUserByField("u_u_i_d", uuid, db)
}

func FindUserByEmail(email string, db *qbs.Qbs) (*User, error) {
	return findUserByField("email", email, db)
}

func findUserByField(fieldName string, value string, db *qbs.Qbs) (*User, error) {
	user := new(User)
	err := db.WhereEqual(fieldName, value).Find(user)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func DeleteAllUsers(db *qbs.Qbs) error {
	var users []*User
	err := db.FindAll(&users)
	if err != nil {
		return err
	}
	for _, user := range users {
		_, err = db.Delete(user)
		if err != nil {
			return err
		}
	}
	return nil
}
