package api

import (
	"encoding/json"
	"net/http"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
)

var FlockProperties = []be.Property{
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
	be.Property{
		Name:        "active",
		Description: "active",
		DataType:    "bool",
	},
	be.Property{
		Name:        "userUUID",
		Description: "user UUID",
		DataType:    "string",
	},
}

var FlocksProperties = be.NewAPIListProperties("flock")

type FlocksResource struct {
}

func NewFlocksResource() *FlocksResource {
	return &FlocksResource{}
}

func (FlocksResource) Name() string  { return "flocks" }
func (FlocksResource) Path() string  { return "/flock/" }
func (FlocksResource) Title() string { return "Flocks" }
func (FlocksResource) Description() string {
	return "A list of flocks, where a flock holds a set of member apps that are privately used by a person."
}

func (resource FlocksResource) Properties() []be.Property {
	return FlocksProperties
}

func (resource FlocksResource) Get(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}

	offset, limit := be.GetOffsetAndLimit(request.Raw.Form)
	records, err := apiDB.FindFlockRecords(request.User.UUID, offset, limit, request.DBInfo)
	if err != nil {
		logger.Println("ERR", err)
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

func (resource FlocksResource) Post(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	var data apiDB.FlockRecord
	err := json.NewDecoder(request.Raw.Body).Decode(&data)
	if err != nil {
		return 400, be.BadRequestError, responseHeader
	}
	record, err := apiDB.CreateFlockRecord(data.Name, request.User.UUID, request.DBInfo)
	if err != nil {
		return 500, be.APIError{
			Id:      "db_error",
			Message: "Database error",
			Error:   err.Error(),
		}, responseHeader
	}
	return 200, record, responseHeader
}

type FlockResource struct {
}

func NewFlockResource() *FlockResource {
	return &FlockResource{}
}

func (FlockResource) Name() string  { return "flock" }
func (FlockResource) Path() string  { return "/flock/{uuid:[0-9,a-z,-]+}" }
func (FlockResource) Title() string { return "Flock" }
func (FlockResource) Description() string {
	return "The information and data required to load a 3D thing into a space."
}

func (resource FlockResource) Properties() []be.Property {
	return FlockProperties
}

func (resource FlockResource) Get(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	uuid, _ := request.PathValues["uuid"]
	flock, err := apiDB.FindFlockRecord(uuid, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_flock",
			Message: "No such flock: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}
	if flock.UserUUID != request.User.UUID {
		return 403, be.ForbiddenError, responseHeader
	}
	return 200, flock, responseHeader
}

func (resource FlockResource) Put(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	uuid, _ := request.PathValues["uuid"]
	flock, err := apiDB.FindFlockRecord(uuid, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_flock",
			Message: "No such flock: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}
	if flock.UserUUID != request.User.UUID {
		return 403, be.ForbiddenError, responseHeader
	}

	var updatedFlock apiDB.FlockRecord
	err = json.NewDecoder(request.Raw.Body).Decode(&updatedFlock)
	if err != nil {
		return 400, be.BadRequestError, responseHeader
	}

	// Only some attributes can be updated
	flock.Name = updatedFlock.Name
	flock.Active = updatedFlock.Active
	err = apiDB.UpdateFlockRecord(flock, request.DBInfo)
	if err != nil {
		return 400, be.APIError{
			Id:      "error_saving",
			Message: "Error saving",
			Error:   err.Error(),
		}, responseHeader
	}

	return 200, flock, responseHeader
}

func (resource FlockResource) Delete(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	flockUUID, _ := request.PathValues["uuid"]
	flock, err := apiDB.FindFlockRecord(flockUUID, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_flock",
			Message: "No such flock: " + flockUUID,
			Error:   err.Error(),
		}, responseHeader
	}
	if flock.UserUUID != request.User.UUID {
		return 403, be.ForbiddenError, responseHeader
	}
	err = apiDB.DeleteFlockRecord(flock, request.DBInfo)
	if err != nil {
		return 500, be.APIError{
			Id:      "error_deleting",
			Message: "Error deleting",
			Error:   err.Error(),
		}, responseHeader
	}
	return 200, "{}", responseHeader
}
