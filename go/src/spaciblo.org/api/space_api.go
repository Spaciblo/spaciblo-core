package api

import (
	"net/http"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
)

var SpaceProperties = []be.Property{
	be.Property{
		Name:        "uuid",
		Description: "uuid",
		DataType:    "string",
		Protected:   true,
	},
	be.Property{
		Name:        "name",
		Description: "name",
		DataType:    "string",
	},
}

var SpacesProperties = be.NewAPIListProperties("space")

type SpacesResource struct {
}

func NewSpacesResource() *SpacesResource {
	return &SpacesResource{}
}

func (SpacesResource) Name() string  { return "spaces" }
func (SpacesResource) Path() string  { return "/space/" }
func (SpacesResource) Title() string { return "Spaces" }
func (SpacesResource) Description() string {
	return "A list of spaces."
}

func (resource SpacesResource) Properties() []be.Property {
	return SpacesProperties
}

func (resource SpacesResource) Get(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	offset, limit := be.GetOffsetAndLimit(request.Raw.Form)
	records, err := apiDB.FindSpaceRecords(offset, limit, request.DBInfo)
	if err != nil {
		return 500, be.APIError{
			Id:      "db_error",
			Message: "Database error",
			Error:   err.Error(),
		}, responseHeader
	}
	list := &be.APIList{
		Offset:  offset,
		Limit:   limit,
		Objects: records,
	}
	return 200, list, responseHeader
}
