package api

import (
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
