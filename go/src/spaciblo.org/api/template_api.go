package api

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"

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
	be.Property{
		Name:        "image",
		Description: "image",
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

var TemplateImageProperties = []be.Property{
	be.Property{
		Name:        "image",
		Description: "The multipart form encoded image representing a template",
		DataType:    "file",
		Optional:    false,
	},
}

/*
TemplateImageResource returns a image representing a template if the template.Image field has a key, otherwise 404
*/
type TemplateImageResource struct{}

func NewTemplateImageResource() *TemplateImageResource {
	return &TemplateImageResource{}
}

func (TemplateImageResource) Name() string                       { return "template-image" }
func (TemplateImageResource) Path() string                       { return "/template/{uuid:[0-9,a-z,-]+}/image" }
func (TemplateImageResource) Title() string                      { return "Template image" }
func (TemplateImageResource) Description() string                { return "The image for a template." }
func (resource TemplateImageResource) Properties() []be.Property { return TemplateImageProperties }

func (resource TemplateImageResource) Get(request *be.APIRequest) (int, interface{}, http.Header) {
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
	if template.Image == "" {
		return 404, be.FileNotFoundError, responseHeader
	}

	// TODO This size should be set via URL params
	imageFile, err := be.FitCrop(128, 128, template.Image, request.FS)
	if err != nil {
		logger.Print("Error with fit crop ", err.Error())
		return 500, &be.APIError{
			Id:      be.InternalServerError.Id,
			Message: "Error reading template image: " + template.Image + ": " + err.Error(),
		}, responseHeader
	}
	err = request.ServeFile(imageFile, responseHeader)
	if err != nil {
		return 500, &be.APIError{
			Id:      be.InternalServerError.Id,
			Message: "Error serving image file: " + err.Error(),
		}, responseHeader
	}

	// Indicate that the response is complete and not to process it like the usual JSON response
	return be.StatusInternallyHandled, nil, nil
}

type TemplateImagePost struct {
	Image string `json:"image"`
}

func (templateImagePost *TemplateImagePost) ImageData() string {
	if templateImagePost.Image == "" {
		return ""
	}
	index := strings.Index(templateImagePost.Image, ",")
	if index < 0 {
		return templateImagePost.Image
	}
	return templateImagePost.Image[index+1:]
}

func (resource TemplateImageResource) Put(request *be.APIRequest) (int, interface{}, http.Header) {
	// Accepts a JSON encoded TemplateImagePost where Image is a base64 encoded image
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

	templateImagePost := TemplateImagePost{}
	err = json.NewDecoder(request.Raw.Body).Decode(&templateImagePost)
	if err != nil {
		logger.Println("Could not decode JSON", err)
		return http.StatusBadRequest, &be.APIError{
			Id:      "bad_request",
			Message: "A base64 encoded `image` field is required up update your template image",
		}, responseHeader
	}
	imageData, err := base64.StdEncoding.DecodeString(templateImagePost.ImageData())
	if err != nil {
		logger.Println("Could not decode base64", err)
		return http.StatusBadRequest, &be.APIError{
			Id:      "bad_request",
			Message: "A base64 encoded `image` field is required up update your template image",
		}, responseHeader
	}
	fileKey, err := request.FS.Put("template_image.jpg", bytes.NewReader(imageData))
	if err != nil {
		logger.Println("Could not store the file", err)
		return http.StatusInternalServerError, &be.APIError{
			Id:      "storage_error",
			Message: "Could not store the file: " + err.Error(),
		}, responseHeader
	}

	oldFileKey := template.Image
	template.Image = fileKey
	err = apiDB.UpdateTemplateRecord(template, request.DBInfo)
	if err != nil {
		logger.Println("Could not update template", err)
		return http.StatusInternalServerError, &be.APIError{
			Id:      "database_error",
			Message: "Could not update the template: " + err.Error(),
		}, responseHeader
	}
	if oldFileKey != "" {
		err = request.FS.Delete(oldFileKey, "")
		if err != nil {
			logger.Println("Could not delete", err)
			logger.Print("Could not delete old image: " + err.Error())
		}
	}
	templateImagePost.Image = fileKey
	return 200, templateImagePost, responseHeader
}
