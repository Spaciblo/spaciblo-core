package api

import (
	"encoding/json"
	"net/http"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
)

var FlockMemberProperties = []be.Property{
	be.Property{Name: "uuid", Description: "uuid", DataType: "string", Protected: true},
	be.Property{Name: "flockUUID", Description: "flock UUID", DataType: "string"},
	be.Property{Name: "templateUUID", Description: "template UUID", DataType: "string"},
	be.Property{Name: "position", Description: "position", DataType: "float array"},
	be.Property{Name: "orientation", Description: "orientation", DataType: "float array"},
	be.Property{Name: "translation", Description: "translation", DataType: "float array"},
	be.Property{Name: "rotation", Description: "rotation", DataType: "float array"},
	be.Property{Name: "scale", Description: "scale", DataType: "float array"},
}

var FlockMembersProperties = be.NewAPIListProperties("flock-member")

type FlockMembersResource struct {
}

func NewFlockMembersResource() *FlockMembersResource {
	return &FlockMembersResource{}
}

func (FlockMembersResource) Name() string  { return "flock-members" }
func (FlockMembersResource) Path() string  { return "/flock/{flock-uuid:[0-9,a-z,-]+}/member/" }
func (FlockMembersResource) Title() string { return "FlockMembers" }
func (FlockMembersResource) Description() string {
	return "A list of members of a flock."
}

func (resource FlockMembersResource) Properties() []be.Property {
	return FlockMembersProperties
}

func (resource FlockMembersResource) Get(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}

	flockUUID, _ := request.PathValues["flock-uuid"]
	flock, err := apiDB.FindFlockRecord(flockUUID, request.DBInfo)
	if err != nil {
		return 404, be.FileNotFoundError, responseHeader
	}
	if flock.UserUUID != request.User.UUID {
		return 403, be.ForbiddenError, responseHeader
	}

	offset, limit := be.GetOffsetAndLimit(request.Raw.Form)
	records, err := apiDB.FindFlockMemberRecords(flockUUID, offset, limit, request.DBInfo)
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

func (resource FlockMembersResource) Post(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	var data apiDB.FlockMemberRecord
	err := json.NewDecoder(request.Raw.Body).Decode(&data)
	if err != nil {
		return 400, be.BadRequestError, responseHeader
	}

	flockUUID, _ := request.PathValues["flock-uuid"]
	flock, err := apiDB.FindFlockRecord(flockUUID, request.DBInfo)
	if err != nil {
		return 404, be.FileNotFoundError, responseHeader
	}
	if flock.UserUUID != request.User.UUID {
		return 403, be.ForbiddenError, responseHeader
	}

	template, err := apiDB.FindTemplateRecord(data.TemplateUUID, request.DBInfo)
	if err != nil {
		return 400, be.APIError{
			Id:      "no_such_template: " + data.TemplateUUID,
			Message: "Could not find template for flock member",
			Error:   err.Error(),
		}, responseHeader
	}

	record, err := apiDB.CreateFlockMemberRecord(flockUUID, template.UUID, request.DBInfo)
	if err != nil {
		return 500, be.APIError{
			Id:      "db_error",
			Message: "Database error",
			Error:   err.Error(),
		}, responseHeader
	}
	return 200, record, responseHeader
}

type FlockMemberResource struct {
}

func NewFlockMemberResource() *FlockMemberResource {
	return &FlockMemberResource{}
}

func (FlockMemberResource) Name() string  { return "flock-member" }
func (FlockMemberResource) Path() string  { return "/flock-member/{uuid:[0-9,a-z,-]+}" }
func (FlockMemberResource) Title() string { return "FlockMember" }
func (FlockMemberResource) Description() string {
	return "The information and data required to load a 3D thing into a space."
}

func (resource FlockMemberResource) Properties() []be.Property {
	return FlockMemberProperties
}

func (resource FlockMemberResource) Get(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}

	uuid, _ := request.PathValues["uuid"]
	flockMember, err := apiDB.FindFlockMemberRecord(uuid, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_flock_member",
			Message: "No such flock member: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}

	flock, err := apiDB.FindFlockRecord(flockMember.FlockUUID, request.DBInfo)
	if err != nil {
		return 500, be.InternalServerError, responseHeader
	}
	if flock.UserUUID != request.User.UUID {
		return 403, be.ForbiddenError, responseHeader
	}

	return 200, flockMember, responseHeader
}

func (resource FlockMemberResource) Put(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	uuid, _ := request.PathValues["uuid"]
	flockMember, err := apiDB.FindFlockMemberRecord(uuid, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_flock_member",
			Message: "No such flock member: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}

	flock, err := apiDB.FindFlockRecord(flockMember.FlockUUID, request.DBInfo)
	if err != nil {
		return 500, be.InternalServerError, responseHeader
	}
	if flock.UserUUID != request.User.UUID {
		return 403, be.ForbiddenError, responseHeader
	}

	var updatedFlockMember apiDB.FlockMemberRecord
	err = json.NewDecoder(request.Raw.Body).Decode(&updatedFlockMember)
	if err != nil {
		return 400, be.BadRequestError, responseHeader
	}

	// Only some attributes can be updated
	flockMember.Position = updatedFlockMember.Position
	flockMember.Orientation = updatedFlockMember.Orientation
	flockMember.Translation = updatedFlockMember.Translation
	flockMember.Rotation = updatedFlockMember.Rotation
	flockMember.Scale = updatedFlockMember.Scale
	err = apiDB.UpdateFlockMemberRecord(flockMember, request.DBInfo)
	if err != nil {
		return 400, be.APIError{
			Id:      "error_saving",
			Message: "Error saving",
			Error:   err.Error(),
		}, responseHeader
	}

	return 200, flockMember, responseHeader
}

func (resource FlockMemberResource) Delete(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	flockMemberUUID, _ := request.PathValues["uuid"]
	flockMember, err := apiDB.FindFlockMemberRecord(flockMemberUUID, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_flock_member",
			Message: "No such flock member: " + flockMemberUUID,
			Error:   err.Error(),
		}, responseHeader
	}

	flock, err := apiDB.FindFlockRecord(flockMember.FlockUUID, request.DBInfo)
	if err != nil {
		return 500, be.InternalServerError, responseHeader
	}
	if flock.UserUUID != request.User.UUID {
		return 403, be.ForbiddenError, responseHeader
	}

	err = apiDB.DeleteFlockMemberRecord(flockMember, request.DBInfo)
	if err != nil {
		return 500, be.APIError{
			Id:      "error_deleting",
			Message: "Error deleting",
			Error:   err.Error(),
		}, responseHeader
	}
	return 200, "{}", responseHeader
}
