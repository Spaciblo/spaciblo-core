package api

import (
	"encoding/json"
	"net/http"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
)

var TemplateProperties = []be.Property{
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

var TemplatesProperties = be.NewAPIListProperties("template")

type TemplatesResource struct {
}

func NewTemplatesResource() *TemplatesResource {
	return &TemplatesResource{}
}

func (TemplatesResource) Name() string  { return "templates" }
func (TemplatesResource) Path() string  { return "/template/" }
func (TemplatesResource) Title() string { return "Templates" }
func (TemplatesResource) Description() string {
	return "A list of templates."
}

func (resource TemplatesResource) Properties() []be.Property {
	return TemplatesProperties
}

func (resource TemplatesResource) Get(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	offset, limit := be.GetOffsetAndLimit(request.Raw.Form)
	records, err := apiDB.FindTemplateRecords(offset, limit, request.DBInfo)
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

func (resource TemplatesResource) Post(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	if request.User.Staff == false {
		return 401, be.StaffOnlyError, responseHeader
	}

	var data apiDB.TemplateRecord
	err := json.NewDecoder(request.Raw.Body).Decode(&data)
	if err != nil {
		return 400, be.BadRequestError, responseHeader
	}
	record, err := apiDB.CreateTemplateRecord(data.Name, data.Geometry, data.ClientScript, data.SimScript, data.Part, data.Parent, request.DBInfo)
	if err != nil {
		return 500, be.APIError{
			Id:      "db_error",
			Message: "Database error",
			Error:   err.Error(),
		}, responseHeader
	}
	return 200, record, responseHeader
}

type TemplateResource struct {
}

func NewTemplateResource() *TemplateResource {
	return &TemplateResource{}
}

func (TemplateResource) Name() string  { return "template" }
func (TemplateResource) Path() string  { return "/template/{uuid:[0-9,a-z,-]+}" }
func (TemplateResource) Title() string { return "Template" }
func (TemplateResource) Description() string {
	return "The information and data required to load a 3D thing into a space."
}

func (resource TemplateResource) Properties() []be.Property {
	return TemplateProperties
}

func (resource TemplateResource) Get(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	uuid, _ := request.PathValues["uuid"]
	template, err := apiDB.FindTemplateRecord(uuid, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_template",
			Message: "No such template: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}
	return 200, template, responseHeader
}

func (resource TemplateResource) Put(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	if request.User.Staff == false {
		return 401, be.StaffOnlyError, responseHeader
	}

	uuid, _ := request.PathValues["uuid"]
	template, err := apiDB.FindTemplateRecord(uuid, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_template",
			Message: "No such template: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}

	var updatedTemplate apiDB.TemplateRecord
	err = json.NewDecoder(request.Raw.Body).Decode(&updatedTemplate)
	if err != nil {
		return 400, be.BadRequestError, responseHeader
	}

	// Only some attributes can be updated
	template.Name = updatedTemplate.Name
	template.Geometry = updatedTemplate.Geometry
	template.ClientScript = updatedTemplate.ClientScript
	template.SimScript = updatedTemplate.SimScript
	template.Parent = updatedTemplate.Parent
	template.Part = updatedTemplate.Part
	err = apiDB.UpdateTemplateRecord(template, request.DBInfo)
	if err != nil {
		return 400, be.APIError{
			Id:      "error_saving",
			Message: "Error saving",
			Error:   err.Error(),
		}, responseHeader
	}

	return 200, template, responseHeader
}

func (resource TemplateResource) Delete(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	if request.User.Staff != true {
		return 401, be.StaffOnlyError, responseHeader
	}

	uuid, _ := request.PathValues["uuid"]

	template, err := apiDB.FindTemplateRecord(uuid, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_template",
			Message: "No such template: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}

	err = apiDB.DeleteTemplateRecord(template, request.FS, request.DBInfo)
	if err != nil {
		return 500, be.APIError{
			Id:      "error_deleting",
			Message: "Error deleting",
			Error:   err.Error(),
		}, responseHeader
	}
	return 200, "{}", responseHeader
}
