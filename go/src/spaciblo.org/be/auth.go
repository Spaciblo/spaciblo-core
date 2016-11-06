package be

import (
	"github.com/Spaciblo/qbs"
	"golang.org/x/crypto/bcrypt"
)

type Password struct {
	Id     int64 `qbs:"pk"`
	UserId int64 `qbs:"fk:User,unique"`
	Hash   string
}

func (password *Password) Encode(plaintext string) error {
	var hash []byte
	hash, err := bcrypt.GenerateFromPassword([]byte(plaintext), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	password.Hash = string(hash)
	return nil
}

func (password *Password) Matches(plaintext string) bool {
	if plaintext == "" || password.Hash == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(password.Hash), []byte(plaintext)) == nil
}

func CreatePassword(plaintext string, userId int64, db *qbs.Qbs) (*Password, error) {
	password := new(Password)
	password.UserId = userId
	password.Encode(plaintext)
	_, err := db.Save(password)
	if err != nil {
		return nil, err
	}
	return password, nil
}

func UpdatePassword(password *Password, db *qbs.Qbs) error {
	_, err := db.Save(password)
	if err != nil {
		return err
	}
	return nil
}

func FindPasswordByUserId(userId int64, db *qbs.Qbs) (*Password, error) {
	password := new(Password)
	err := db.WhereEqual("user_id", userId).Find(password)
	if err != nil {
		return nil, err
	}
	return password, nil
}

func PasswordMatches(userId int64, plaintext string, db *qbs.Qbs) bool {
	password, err := FindPasswordByUserId(userId, db)
	if err != nil {
		return false
	}
	return password.Matches(plaintext)
}

func DeleteAllPasswords(db *qbs.Qbs) error {
	var passwords []*Password
	err := db.FindAll(&passwords)
	if err != nil {
		return err
	}
	for _, password := range passwords {
		_, err = db.Delete(password)
		if err != nil {
			return err
		}
	}
	return nil
}
