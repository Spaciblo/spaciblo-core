package be

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/lib/pq" // Needed to make the postgres driver available
	"gopkg.in/gorp.v2"
)

var NilTime = new(time.Time) // NilTime.Equal(record.field) will reveal whether the timestamp is set

var DBName = os.Getenv("POSTGRES_DB_NAME")
var DBUser = os.Getenv("POSTGRES_USER")
var DBPass = os.Getenv("POSTGRES_PASSWORD")
var DBHost = os.Getenv("POSTGRES_HOST")
var DBPort = os.Getenv("POSTGRES_PORT")

var DBURLFormat = "postgres://%s:%s@%s:%s/%s?sslmode=disable"
var DBConfigFormat = "user=%s password=%s host=%s port=%s dbname=%s sslmode=disable"

type DBInfo struct {
	Connection *sql.DB
	Map        *gorp.DbMap
}

func OpenDB() (*DBInfo, error) {
	db, err := sql.Open("postgres", fmt.Sprintf(DBConfigFormat, DBUser, DBPass, DBHost, DBPort, DBName))
	if err != nil {
		logger.Print("Open Error: " + err.Error())
		return nil, err
	}
	err = db.Ping()
	if err != nil {
		logger.Print("Ping Error: " + err.Error())
		return nil, err
	}
	dbInfo := &DBInfo{
		Connection: db,
		Map:        &gorp.DbMap{Db: db, Dialect: gorp.PostgresDialect{}},
	}
	return dbInfo, nil
}

func InitDB() (*DBInfo, error) {
	dbInfo, err := OpenDB()
	if err != nil {
		return nil, err
	}
	err = migrateDB(dbInfo)
	if err != nil {
		return nil, err
	}
	return dbInfo, nil
}

func migrateDB(dbInfo *DBInfo) error {
	dbInfo.Map.AddTableWithName(User{}, UserTable).SetKeys(true, "Id")
	dbInfo.Map.AddTableWithName(Password{}, PasswordTable).SetKeys(true, "Id")
	err := dbInfo.Map.CreateTablesIfNotExists()
	if err != nil {
		return err
	}
	return nil
}

func WipeDB(dbInfo *DBInfo) error {
	dbInfo.Map.DropTables()
	return nil
}

func CreateDB() error {
	db, err := sql.Open("postgres", fmt.Sprintf(DBConfigFormat, DBUser, DBPass, DBHost, DBPort, DBUser))
	if err != nil {
		return err
	}
	defer db.Close()
	err = db.Ping()
	if err != nil {
		return err
	}
	_, err = db.Exec("create database " + DBName + ";")
	if err != nil {
		// Ignoring... probably means that the DB already existed
		//logger.Print("DB Creation error (ignoring): " + err.Error())
	}
	return nil
}
