/*
Package api/db holds all of the record types and database configuration for the api service.
*/
package db

import (
	"errors"
	"log"
	"os"
	"strconv"
	"strings"

	"spaciblo.org/be"
)

var logger = log.New(os.Stdout, "[api/db] ", 0)

const TEST_DATA_DIR = "test_data"
const SPACES_DATA_DIR = "spaces"
const AVATARS_DATA_DIR = "avatars"
const TEMPLATES_DATA_DIR = "templates"

func MigrateDB(dbInfo *be.DBInfo) error {
	dbInfo.Map.AddTableWithName(SpaceRecord{}, SpaceTable).SetKeys(true, "Id")
	dbInfo.Map.AddTableWithName(TemplateRecord{}, TemplateTable).SetKeys(true, "Id")
	dbInfo.Map.AddTableWithName(TemplateDataRecord{}, TemplateDataTable).SetKeys(true, "Id")
	dbInfo.Map.AddTableWithName(AvatarRecord{}, AvatarTable).SetKeys(true, "Id")
	dbInfo.Map.AddTableWithName(AvatarPartRecord{}, AvatarPartTable).SetKeys(true, "Id")
	dbInfo.Map.AddTableWithName(FlockRecord{}, FlockTable).SetKeys(true, "Id")
	dbInfo.Map.AddTableWithName(FlockMemberRecord{}, FlockMemberTable).SetKeys(true, "Id")
	err := dbInfo.Map.CreateTablesIfNotExists()
	if err != nil {
		return err
	}
	return nil
}

/*
Convert []float{0, 1.5, 2} to "0,1.5,2"
*/
func EncodeFloatArrayString(floatArray []float64) string {
	tokens := []string{}
	for _, flt := range floatArray {
		tokens = append(tokens, strconv.FormatFloat(flt, 'f', -1, 64))
	}
	return strings.Join(tokens, ",")
}

/*
Convert "0.5,1,0" to []float64{0.5,1,0}
*/
func DecodeFloatArrayString(arrayString string, expectedCount int, defaultValue []float64) ([]float64, error) {
	if arrayString == "" {
		return defaultValue, nil
	}
	tokens := strings.Split(arrayString, ",")
	if len(tokens) != expectedCount {
		return nil, errors.New("Unexpected array string length")
	}
	results := []float64{}
	for _, token := range tokens {
		flt, err := strconv.ParseFloat(token, 64)
		if err != nil {
			return nil, err
		}
		results = append(results, flt)
	}
	return results, nil
}
