package be

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	"github.com/Spaciblo/qbs"
	_ "github.com/lib/pq" // Needed to make the postgres driver available
)

var NilTime = new(time.Time) // NilTime.Equal(record.field) will reveal whether the timestamp is set

var DBName = os.Getenv("POSTGRES_DB_NAME")
var DBUser = os.Getenv("POSTGRES_USER")
var DBPass = os.Getenv("POSTGRES_PASSWORD")
var DBHost = os.Getenv("POSTGRES_HOST")
var DBPort = os.Getenv("POSTGRES_PORT")

var DBURLFormat = "postgres://%s:%s@%s:%s/%s?sslmode=disable"
var DBConfigFormat = "user=%s password=%s host=%s port=%s dbname=%s sslmode=disable"

func InitDB() error {
	err := registerDB()
	if err != nil {
		return err
	}
	err = migrateDB()
	if err != nil {
		return err
	}
	return nil
}

func registerDB() error {
	dsn := &qbs.DataSourceName{
		DbName:   DBName,
		Username: DBUser,
		Password: DBPass,
		Host:     DBHost,
		Port:     DBPort,
		Dialect:  qbs.NewPostgres(),
	}
	dsn.Append("sslmode", "disable")
	qbs.RegisterWithDataSourceName(dsn)
	return nil
}

func migrateDB() error {
	migration, err := qbs.GetMigration()
	if err != nil {
		return err
	}
	defer migration.Close()
	migration.CreateTableIfNotExists(new(User))
	migration.CreateTableIfNotExists(new(Password))
	return nil
}

func WipeDB() {
	db, _ := qbs.GetQbs()

	var passwords []*Password
	db.FindAll(&passwords)
	for _, password := range passwords {
		db.Delete(password)
	}

	var users []*User
	db.FindAll(&users)
	for _, user := range users {
		db.Delete(user)
	}
}

func CreateAndInitDB() error {
	db, err := sql.Open("postgres", fmt.Sprintf(DBConfigFormat, DBUser, DBPass, DBHost, DBPort, DBUser))
	if err != nil {
		logger.Print("Open Error: " + err.Error())
		return err
	}
	defer db.Close()

	err = db.Ping()
	if err != nil {
		logger.Print("Ping Error: " + err.Error())
		return err
	}

	_, err = db.Exec("create database " + DBName + ";")
	if err != nil {
		// Ignoring...
	}

	InitDB()
	return nil
}
