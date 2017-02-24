package api

import (
	"encoding/json"
	"net/http"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
)

var AvatarProperties = []be.Property{
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

var AvatarsProperties = be.NewAPIListProperties("avatar")

type AvatarsResource struct {
}

func NewAvatarsResource() *AvatarsResource {
	return &AvatarsResource{}
}

func (AvatarsResource) Name() string  { return "avatars" }
func (AvatarsResource) Path() string  { return "/avatar/" }
func (AvatarsResource) Title() string { return "Avatars" }
func (AvatarsResource) Description() string {
	return "A list of avatars."
}

func (resource AvatarsResource) Properties() []be.Property {
	return AvatarsProperties
}

func (resource AvatarsResource) Get(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	offset, limit := be.GetOffsetAndLimit(request.Raw.Form)
	records, err := apiDB.FindAvatarRecords(offset, limit, request.DBInfo)
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

func (resource AvatarsResource) Post(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	if request.User.Staff == false {
		return 401, be.StaffOnlyError, responseHeader
	}

	var data apiDB.AvatarRecord
	err := json.NewDecoder(request.Raw.Body).Decode(&data)
	if err != nil {
		return 400, be.BadRequestError, responseHeader
	}
	record, err := apiDB.CreateAvatarRecord(data.Name, request.DBInfo)
	if err != nil {
		return 500, be.APIError{
			Id:      "db_error",
			Message: "Database error",
			Error:   err.Error(),
		}, responseHeader
	}
	return 200, record, responseHeader
}

func (resource AvatarResource) Delete(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	if request.User.Staff == false {
		return 401, be.StaffOnlyError, responseHeader
	}

	avatarUUID, _ := request.PathValues["uuid"]
	avatar, err := apiDB.FindAvatarRecord(avatarUUID, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_avatar",
			Message: "No such avatar: " + avatarUUID,
			Error:   err.Error(),
		}, responseHeader
	}

	err = apiDB.DeleteAvatarRecord(avatar, request.DBInfo)
	if err != nil {
		return 500, be.APIError{
			Id:      "error_deleting",
			Message: "Error deleting",
			Error:   err.Error(),
		}, responseHeader
	}
	return 200, "{}", responseHeader
}

type AvatarResource struct {
}

func NewAvatarResource() *AvatarResource {
	return &AvatarResource{}
}

func (AvatarResource) Name() string  { return "avatar" }
func (AvatarResource) Path() string  { return "/avatar/{uuid:[0-9,a-z,-]+}" }
func (AvatarResource) Title() string { return "Avatar" }
func (AvatarResource) Description() string {
	return "The information and data required to load a 3D thing into a space."
}

func (resource AvatarResource) Properties() []be.Property {
	return AvatarProperties
}

func (resource AvatarResource) Get(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	uuid, _ := request.PathValues["uuid"]
	avatar, err := apiDB.FindAvatarRecord(uuid, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_avatar",
			Message: "No such avatar: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}
	return 200, avatar, responseHeader
}

func (resource AvatarResource) Put(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	if request.User.Staff == false {
		return 401, be.StaffOnlyError, responseHeader
	}

	uuid, _ := request.PathValues["uuid"]
	avatar, err := apiDB.FindAvatarRecord(uuid, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_avatar",
			Message: "No such avatar: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}

	var updatedAvatar apiDB.AvatarRecord
	err = json.NewDecoder(request.Raw.Body).Decode(&updatedAvatar)
	if err != nil {
		return 400, be.BadRequestError, responseHeader
	}

	// Only some attributes can be updated
	avatar.Name = updatedAvatar.Name
	err = apiDB.UpdateAvatarRecord(avatar, request.DBInfo)
	if err != nil {
		return 400, be.APIError{
			Id:      "error_saving",
			Message: "Error saving",
			Error:   err.Error(),
		}, responseHeader
	}

	return 200, avatar, responseHeader
}
