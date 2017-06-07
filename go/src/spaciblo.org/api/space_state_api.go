package api

import (
	"net/http"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
)

var SpaceStateProperties = []be.Property{
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

type SpaceStateResource struct {
}

func NewSpaceStateResource() *SpaceStateResource {
	return &SpaceStateResource{}
}

func (SpaceStateResource) Name() string  { return "space-state" }
func (SpaceStateResource) Path() string  { return "/space-state/{uuid:[0-9,a-z,-]+}" }
func (SpaceStateResource) Title() string { return "Space State" }
func (SpaceStateResource) Description() string {
	return "The serialized format of a space that can be used to store and later load a space."
}

func (resource SpaceStateResource) Properties() []be.Property {
	return SpaceStateProperties
}

func (resource SpaceStateResource) Get(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	uuid, _ := request.PathValues["uuid"]
	space, err := apiDB.FindSpaceRecord(uuid, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_space",
			Message: "No such space: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}
	state, err := space.DecodeState()
	if err != nil {
		return 500, be.APIError{
			Id:      "could_not_decode",
			Message: "Could not decode: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}
	err = state.FillInTemplateNames(request.DBInfo)
	if err != nil {
		return 500, be.APIError{
			Id:      "could_not_find_templates",
			Message: "Could not find templates: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}
	return 200, state, responseHeader
}
