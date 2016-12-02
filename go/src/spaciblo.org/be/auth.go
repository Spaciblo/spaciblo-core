package be

import (
	"golang.org/x/crypto/bcrypt"
)

const PasswordTable = "passwords"

type Password struct {
	Id     int64 `db:"id, primarykey, autoincrement"`
	UserId int64 `db:"user_id"`
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

func CreatePassword(plaintext string, userId int64, dbInfo *DBInfo) (*Password, error) {
	password := new(Password)
	password.UserId = userId
	password.Encode(plaintext)
	err := dbInfo.Map.Insert(password)
	if err != nil {
		return nil, err
	}
	return password, nil
}

func UpdatePassword(password *Password, dbInfo *DBInfo) error {
	_, err := dbInfo.Map.Update(password)
	if err != nil {
		return err
	}
	return nil
}

func FindAllPasswords(dbInfo *DBInfo) ([]*Password, error) {
	var passwords []*Password
	_, err := dbInfo.Map.Select(&passwords, "select * from "+PasswordTable+" order by id desc")
	return passwords, err
}

func FindPasswordByUserId(userId int64, dbInfo *DBInfo) (*Password, error) {
	password := new(Password)
	err := dbInfo.Map.SelectOne(password, "select * from "+PasswordTable+" where user_id=$1", userId)
	if err != nil {
		return nil, err
	}
	return password, nil
}

func PasswordMatches(userId int64, plaintext string, dbInfo *DBInfo) bool {
	password, err := FindPasswordByUserId(userId, dbInfo)
	if err != nil {
		return false
	}
	return password.Matches(plaintext)
}

func DeleteAllPasswords(dbInfo *DBInfo) error {
	passwords, err := FindAllPasswords(dbInfo)
	if err != nil {
		return err
	}
	for _, password := range passwords {
		_, err = dbInfo.Map.Delete(password)
		if err != nil {
			return err
		}
	}
	return nil
}
