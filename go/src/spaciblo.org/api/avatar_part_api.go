package api

import (
	"encoding/json"
	"net/http"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
)

var AvatarPartProperties = []be.Property{
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

var AvatarPartsProperties = be.NewAPIListProperties("avatar-part")

type AvatarPartsResource struct {
}

func NewAvatarPartsResource() *AvatarPartsResource {
	return &AvatarPartsResource{}
}

func (AvatarPartsResource) Name() string  { return "avatar-parts" }
func (AvatarPartsResource) Path() string  { return "/avatar/{avatar-uuid:[0-9,a-z,-]+}/part/" }
func (AvatarPartsResource) Title() string { return "AvatarParts" }
func (AvatarPartsResource) Description() string {
	return "A list of avatars."
}

func (resource AvatarPartsResource) Properties() []be.Property {
	return AvatarPartsProperties
}

func (resource AvatarPartsResource) Get(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	offset, limit := be.GetOffsetAndLimit(request.Raw.Form)

	avatarUUID, _ := request.PathValues["avatar-uuid"]
	avatar, err := apiDB.FindAvatarRecord(avatarUUID, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_avatar",
			Message: "No such avatar: " + avatarUUID,
			Error:   err.Error(),
		}, responseHeader
	}

	records, err := apiDB.FindAvatarPartRecords(avatar.Id, offset, limit, request.DBInfo)
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

func (resource AvatarPartsResource) Post(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	if request.User.Staff == false {
		return 401, be.StaffOnlyError, responseHeader
	}

	avatarUUID, _ := request.PathValues["avatar-uuid"]
	avatar, err := apiDB.FindAvatarRecord(avatarUUID, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_avatar",
			Message: "No such avatar: " + avatarUUID,
			Error:   err.Error(),
		}, responseHeader
	}

	data := &apiDB.AvatarPartRecord{}
	err = json.NewDecoder(request.Raw.Body).Decode(data)
	if err != nil {
		return 400, be.BadRequestError, responseHeader
	}

	template, err := apiDB.FindTemplateRecord(data.TemplateUUID, request.DBInfo)
	templateUUID := ""
	if err == nil {
		templateUUID = template.UUID
	}

	record, err := apiDB.CreateAvatarPartRecord(avatar.Id, templateUUID, data.Name, data.Part, data.Parent, "0,0,0", "0,0,0,1", "1,1,1", request.DBInfo)
	if err != nil {
		return 500, be.APIError{
			Id:      "db_error",
			Message: "Database error",
			Error:   err.Error(),
		}, responseHeader
	}
	return 200, record, responseHeader
}

type AvatarPartResource struct {
}

func NewAvatarPartResource() *AvatarPartResource {
	return &AvatarPartResource{}
}

func (AvatarPartResource) Name() string { return "avatar-part" }
func (AvatarPartResource) Path() string {
	return "/avatar/{avatar-uuid:[0-9,a-z,-]+}/part/{uuid:[0-9,a-z,-]+}"
}
func (AvatarPartResource) Title() string { return "AvatarPart" }
func (AvatarPartResource) Description() string {
	return "A part of an avatar, like a head or a hat."
}

func (resource AvatarPartResource) Properties() []be.Property {
	return AvatarPartProperties
}

func (resource AvatarPartResource) Get(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}

	avatarUUID, _ := request.PathValues["avatar-uuid"]
	_, err := apiDB.FindAvatarRecord(avatarUUID, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_avatar",
			Message: "No such avatar: " + avatarUUID,
			Error:   err.Error(),
		}, responseHeader
	}

	partUUID, _ := request.PathValues["uuid"]
	avatarPart, err := apiDB.FindAvatarPartRecord(partUUID, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_avatar_part",
			Message: "No such avatar part: " + partUUID,
			Error:   err.Error(),
		}, responseHeader
	}
	return 200, avatarPart, responseHeader
}

func (resource AvatarPartResource) Put(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	if request.User.Staff == false {
		return 401, be.StaffOnlyError, responseHeader
	}

	avatarUUID, _ := request.PathValues["avatar-uuid"]
	_, err := apiDB.FindAvatarRecord(avatarUUID, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_avatar",
			Message: "No such avatar: " + avatarUUID,
			Error:   err.Error(),
		}, responseHeader
	}

	partUUID, _ := request.PathValues["uuid"]
	avatarPart, err := apiDB.FindAvatarPartRecord(partUUID, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_avatar_part",
			Message: "No such avatar part: " + partUUID,
			Error:   err.Error(),
		}, responseHeader
	}

	var updatedAvatarPart apiDB.AvatarPartRecord
	err = json.NewDecoder(request.Raw.Body).Decode(&updatedAvatarPart)
	if err != nil {
		return 400, be.BadRequestError, responseHeader
	}

	if updatedAvatarPart.TemplateUUID != "" {
		_, err = apiDB.FindTemplateRecord(updatedAvatarPart.TemplateUUID, request.DBInfo)
		if err != nil {
			return 400, be.APIError{
				Id:      "no_such_template_id",
				Message: "No such template id: " + updatedAvatarPart.TemplateUUID,
				Error:   err.Error(),
			}, responseHeader
		}
	}

	// Only some attributes can be updated
	avatarPart.Name = updatedAvatarPart.Name
	avatarPart.Part = updatedAvatarPart.Part
	avatarPart.Parent = updatedAvatarPart.Parent
	avatarPart.Position = updatedAvatarPart.Position
	avatarPart.Orientation = updatedAvatarPart.Orientation
	avatarPart.Scale = updatedAvatarPart.Scale
	avatarPart.TemplateUUID = updatedAvatarPart.TemplateUUID
	err = apiDB.UpdateAvatarPartRecord(avatarPart, request.DBInfo)
	if err != nil {
		return 400, be.APIError{
			Id:      "error_saving",
			Message: "Error saving",
			Error:   err.Error(),
		}, responseHeader
	}

	return 200, avatarPart, responseHeader
}

func (resource AvatarPartResource) Delete(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	if request.User.Staff == false {
		return 401, be.StaffOnlyError, responseHeader
	}

	avatarUUID, _ := request.PathValues["avatar-uuid"]
	_, err := apiDB.FindAvatarRecord(avatarUUID, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_avatar",
			Message: "No such avatar: " + avatarUUID,
			Error:   err.Error(),
		}, responseHeader
	}

	partUUID, _ := request.PathValues["uuid"]
	avatarPart, err := apiDB.FindAvatarPartRecord(partUUID, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_avatar_part",
			Message: "No such avatar part: " + partUUID,
			Error:   err.Error(),
		}, responseHeader
	}

	err = apiDB.DeleteAvatarPartRecord(avatarPart, request.DBInfo)
	if err != nil {
		return 500, be.APIError{
			Id:      "error_deleting",
			Message: "Error deleting",
			Error:   err.Error(),
		}, responseHeader
	}
	return 200, "{}", responseHeader
}
