package be

import (
	"time"
)

const UserTable = "users"

type User struct {
	Id         int64     `json:"id" db:"id, primarykey, autoincrement"`
	UUID       string    `json:"uuid" db:"u_u_i_d"`
	Email      string    `json:"email" db:"email"`
	FirstName  string    `json:"first-name" db:"first_name"`
	LastName   string    `json:"last-name" db:"last_name"`
	Staff      bool      `json:"staff" db:"staff"`
	Image      string    `json:"image" db:"image"`
	AvatarUUID string    `json:"avatarUUID" db:"avatar"`
	Created    time.Time `json:"created" db:"created"`
	Updated    time.Time `json:"updated" db:"updated"`
}

func (user *User) DisplayName() string {
	if user.FirstName != "" && user.LastName == "" {
		return user.FirstName
	}
	if user.LastName != "" && user.FirstName == "" {
		return user.LastName
	}
	if user.FirstName == "" && user.LastName == "" {
		return "Unnamed User"
	}
	return user.FirstName + " " + user.LastName
}

func CreateUser(email string, firstName string, lastName string, staff bool, avatarUUID string, dbInfo *DBInfo) (*User, error) {
	user := new(User)
	user.UUID = UUID()
	user.Email = email
	user.FirstName = firstName
	user.LastName = lastName
	user.Staff = staff
	user.AvatarUUID = avatarUUID
	err := dbInfo.Map.Insert(user)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func UpdateUser(user *User, dbInfo *DBInfo) error {
	err := dbInfo.Connection.Ping()
	if err != nil {
		logger.Printf("Ping error %s", err)
		return err
	}
	_, err = dbInfo.Map.Update(user)
	if err != nil {
		return err
	}
	return nil
}

func FindUsers(offset int, limit int, dbInfo *DBInfo) ([]User, error) {
	var users []User
	_, err := dbInfo.Map.Select(&users, "select * from "+UserTable+" order by id desc limit $1 offset $2", limit, offset)
	return users, err
}

func FindAllUsers(dbInfo *DBInfo) ([]*User, error) {
	var users []*User
	_, err := dbInfo.Map.Select(&users, "select * from "+UserTable+" order by id desc")
	return users, err
}

func FindUser(uuid string, dbInfo *DBInfo) (*User, error) {
	return findUserByField("u_u_i_d", uuid, dbInfo)
}

func FindUserByEmail(email string, dbInfo *DBInfo) (*User, error) {
	return findUserByField("email", email, dbInfo)
}

func findUserByField(fieldName string, value string, dbInfo *DBInfo) (*User, error) {
	user := new(User)
	err := dbInfo.Map.SelectOne(user, "select * from "+UserTable+" where "+fieldName+"=$1", value)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func DeleteAllUsers(dbInfo *DBInfo) error {
	users, err := FindAllUsers(dbInfo)
	if err != nil {
		return err
	}
	for _, user := range users {
		_, err = dbInfo.Map.Delete(user)
		if err != nil {
			return err
		}
	}
	return nil
}
