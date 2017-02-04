package api

import (
	"encoding/json"
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

func (resource SpacesResource) Post(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	if request.User.Staff == false {
		return 401, be.StaffOnlyError, responseHeader
	}

	var data apiDB.SpaceRecord
	err := json.NewDecoder(request.Raw.Body).Decode(&data)
	if err != nil {
		return 400, be.BadRequestError, responseHeader
	}

	avatarRecord, err := apiDB.FindDefaultAvatarRecord(request.DBInfo)
	if err != nil {
		logger.Println("Error finding the default avatar", err)
		return 500, be.APIError{
			Id:      "avatar_record_error",
			Message: "Error finding the default avatar",
			Error:   err.Error(),
		}, responseHeader
	}

	record, err := apiDB.CreateSpaceRecord(data.Name, "{}", avatarRecord.UUID, request.DBInfo)
	if err != nil {
		logger.Println("Error creating a space record", err)
		return 500, be.APIError{
			Id:      "db_error",
			Message: "Database error",
			Error:   err.Error(),
		}, responseHeader
	}
	return 200, record, responseHeader
}

type SpaceResource struct {
}

func NewSpaceResource() *SpaceResource {
	return &SpaceResource{}
}

func (SpaceResource) Name() string  { return "space" }
func (SpaceResource) Path() string  { return "/space/{uuid:[0-9,a-z,-]+}" }
func (SpaceResource) Title() string { return "Space" }
func (SpaceResource) Description() string {
	return "The information and data required to load a 3D thing into a space."
}

func (resource SpaceResource) Properties() []be.Property {
	return SpaceProperties
}

func (resource SpaceResource) Get(request *be.APIRequest) (int, interface{}, http.Header) {
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
	return 200, space, responseHeader
}

func (resource SpaceResource) Put(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	if request.User.Staff == false {
		return 401, be.StaffOnlyError, responseHeader
	}

	uuid, _ := request.PathValues["uuid"]
	record, err := apiDB.FindSpaceRecord(uuid, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_space",
			Message: "No such space: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}

	var updatedRecord apiDB.SpaceRecord
	err = json.NewDecoder(request.Raw.Body).Decode(&updatedRecord)
	if err != nil {
		return 400, be.BadRequestError, responseHeader
	}

	// Only some attributes can be updated
	record.Name = updatedRecord.Name
	err = apiDB.UpdateSpaceRecord(record, request.DBInfo)
	if err != nil {
		return 400, be.APIError{
			Id:      "error_saving",
			Message: "Error saving",
			Error:   err.Error(),
		}, responseHeader
	}

	return 200, record, responseHeader
}
