/*
Package api/db holds all of the record types and database configuration for the api service.
*/
package db

import (
	"spaciblo.org/be"
)

func MigrateDB(dbInfo *be.DBInfo) error {
	dbInfo.Map.AddTableWithName(SpaceRecord{}, SpaceTable).SetKeys(true, "Id")
	err := dbInfo.Map.CreateTablesIfNotExists()
	if err != nil {
		return err
	}
	return nil
}
