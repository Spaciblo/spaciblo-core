/*
Package db holds the service-wide database configuration functionality.

It mostly calls into other <package>/db/ methods.
*/
package db

import (
	"errors"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
)

/*
InitDB sets up a be.DBInfo and migrates the api, sim, and ws tables
*/
func InitDB() (*be.DBInfo, error) {
	dbInfo, err := be.InitDB()
	if err != nil {
		return nil, errors.New("DB Initialization Error: " + err.Error())
	}
	err = apiDB.MigrateDB(dbInfo)
	if err != nil {
		return nil, errors.New("API DB Migration Error: " + err.Error())
	}
	return dbInfo, nil
}
