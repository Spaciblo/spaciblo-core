/*
Package api/db holds all of the record types and database configuration for the api service.
*/
package db

import (
	"log"
	"os"

	"spaciblo.org/be"
)

var logger = log.New(os.Stdout, "[api/db] ", 0)

const TEST_DATA_DIR = "test_data"
const SPACES_DATA_DIR = "spaces"
const TEMPLATES_DATA_DIR = "templates"

func MigrateDB(dbInfo *be.DBInfo) error {
	dbInfo.Map.AddTableWithName(SpaceRecord{}, SpaceTable).SetKeys(true, "Id")
	dbInfo.Map.AddTableWithName(TemplateRecord{}, TemplateTable).SetKeys(true, "Id")
	dbInfo.Map.AddTableWithName(TemplateDataRecord{}, TemplateDataTable).SetKeys(true, "Id")
	err := dbInfo.Map.CreateTablesIfNotExists()
	if err != nil {
		return err
	}
	return nil
}
