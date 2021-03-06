package api

import (
	"bytes"
	"encoding/json"
	"net/http"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
)

var TemplateDataProperties = []be.Property{
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

var TemplateDataListProperties = be.NewAPIListProperties("template-data")

type TemplateDataListResource struct {
}

func NewTemplateDataListResource() *TemplateDataListResource {
	return &TemplateDataListResource{}
}

func (TemplateDataListResource) Name() string  { return "template-data-list" }
func (TemplateDataListResource) Path() string  { return "/template/{uuid:[0-9,a-z,-]+}/data/" }
func (TemplateDataListResource) Title() string { return "TemplateDataList" }
func (TemplateDataListResource) Description() string {
	return "A list of data (glTF, vertices, textures, etc) for a template."
}

func (resource TemplateDataListResource) Properties() []be.Property {
	return TemplateDataListProperties
}

func (resource TemplateDataListResource) Post(request *be.APIRequest) (int, interface{}, http.Header) {
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
			Id:      "no_such_template_error",
			Message: "No such template: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}

	var data interface{}
	err = json.NewDecoder(request.Raw.Body).Decode(&data)
	if err != nil {
		return 400, be.JSONParseError, responseHeader
	}
	var name = data.(map[string]interface{})["name"].(string)

	fileKey, err := request.FS.Put(name, bytes.NewBufferString(""))
	if err != nil {
		return http.StatusInternalServerError, be.APIError{
			Id:      "storage_error",
			Message: "Could not store the file: " + err.Error(),
		}, responseHeader
	}

	templateData, err := apiDB.FindTemplateDataRecord(template.Id, name, request.DBInfo)
	if err == nil {
		// TemplateDataRecord exists, update it
		request.FS.Delete(templateData.Key, "")
		templateData.Key = fileKey
		err = apiDB.UpdateTemplateDataRecord(templateData, request.DBInfo)
		if err != nil {
			return http.StatusInternalServerError, be.APIError{
				Id:      "update_error",
				Message: "Could not update the record: " + err.Error(),
			}, responseHeader
		}
	} else {
		// TemplateDataRecord does not exist, create one
		templateData, err = apiDB.CreateTemplateDataRecord(template.Id, name, fileKey, request.DBInfo)
		if err != nil {
			return http.StatusInternalServerError, be.APIError{
				Id:      "creation_error",
				Message: "Could not create the record: " + err.Error(),
			}, responseHeader
		}
	}
	return 200, templateData, responseHeader
}

func (resource TemplateDataListResource) PostForm(request *be.APIRequest) (int, interface{}, http.Header) {
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
			Id:      "no_such_template_error",
			Message: "No such template: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}

	file, fileHeader, err := request.Raw.FormFile("file")
	if err != nil {
		return http.StatusBadRequest, be.APIError{
			Id:      "bad_request",
			Message: "A `file` field is required",
		}, responseHeader
	}
	fileKey, err := request.FS.Put(fileHeader.Filename, file)
	if err != nil {
		return http.StatusInternalServerError, be.APIError{
			Id:      "storage_error",
			Message: "Could not store the file: " + err.Error(),
		}, responseHeader
	}

	templateData, err := apiDB.FindTemplateDataRecord(template.Id, fileHeader.Filename, request.DBInfo)
	if err == nil {
		// TemplateDataRecord exists, update it
		request.FS.Delete(templateData.Key, "")
		templateData.Key = fileKey
		err = apiDB.UpdateTemplateDataRecord(templateData, request.DBInfo)
		if err != nil {
			return http.StatusInternalServerError, be.APIError{
				Id:      "update_error",
				Message: "Could not update the record: " + err.Error(),
			}, responseHeader
		}
	} else {
		// TemplateDataRecord does not exist, create one
		templateData, err = apiDB.CreateTemplateDataRecord(template.Id, fileHeader.Filename, fileKey, request.DBInfo)
		if err != nil {
			return http.StatusInternalServerError, be.APIError{
				Id:      "creation_error",
				Message: "Could not create the record: " + err.Error(),
			}, responseHeader
		}
	}
	return 200, templateData, responseHeader
}

func (resource TemplateDataListResource) Get(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	offset, limit := be.GetOffsetAndLimit(request.Raw.Form)

	uuid, _ := request.PathValues["uuid"]
	template, err := apiDB.FindTemplateRecord(uuid, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_template_error",
			Message: "No such template: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}

	records, err := apiDB.FindTemplateDataRecords(template.Id, offset, limit, request.DBInfo)
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

type TemplateDataResource struct {
}

func NewTemplateDataResource() *TemplateDataResource {
	return &TemplateDataResource{}
}

func (TemplateDataResource) Name() string { return "template-data" }
func (TemplateDataResource) Path() string {
	return "/template/{uuid:[0-9,a-z,-]+}/data/{name:[^/]+}"
}
func (TemplateDataResource) Title() string { return "TemplateData" }
func (TemplateDataResource) Description() string {
	return "The data blobs (gltf, textures, vertices, etc) required to load a 3D thing into a space."
}

func (resource TemplateDataResource) Properties() []be.Property {
	return TemplateDataProperties
}

func (resource TemplateDataResource) Get(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	uuid, _ := request.PathValues["uuid"]
	name, _ := request.PathValues["name"]

	template, err := apiDB.FindTemplateRecord(uuid, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_template",
			Message: "No such template: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}

	templateData, err := apiDB.FindTemplateDataRecord(template.Id, name, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_template_data",
			Message: "No such template data: " + uuid + ", " + name,
			Error:   err.Error(),
		}, responseHeader
	}

	file, err := request.FS.Get(templateData.Key, "")
	if err != nil {
		return 500, be.APIError{
			Id:      "no_such_template_data_file",
			Message: "No such template data file: " + uuid + ", " + name + ", " + templateData.Key,
			Error:   err.Error(),
		}, responseHeader
	}

	responseHeader["Etag"] = etagForTemplateData(templateData, request.Version)
	// Check whether the client's If-None-Match and the response header's ETag match
	if responseHeader["Etag"][0] == request.Raw.Header.Get("If-None-Match") {
		return 200, nil, responseHeader
	}

	err = request.ServeFile(file, responseHeader)
	if err != nil {
		return 500, be.APIError{
			Id:      be.InternalServerError.Id,
			Message: "Error serving template data: " + err.Error(),
		}, responseHeader
	}
	return be.StatusInternallyHandled, nil, nil
}

func (resource TemplateDataResource) Put(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	uuid, _ := request.PathValues["uuid"]
	name, _ := request.PathValues["name"]

	template, err := apiDB.FindTemplateRecord(uuid, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_template",
			Message: "No such template: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}

	templateData, err := apiDB.FindTemplateDataRecord(template.Id, name, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_template_data",
			Message: "No such template data: " + uuid + ", " + name,
			Error:   err.Error(),
		}, responseHeader
	}
	fileKey, err := request.FS.Put(templateData.Name, request.Raw.Body)
	if err != nil {
		return http.StatusInternalServerError, be.APIError{
			Id:      "storage_error",
			Message: "Could not store the file: " + err.Error(),
		}, responseHeader
	}

	request.FS.Delete(templateData.Key, "")
	templateData.Key = fileKey
	err = apiDB.UpdateTemplateDataRecord(templateData, request.DBInfo)
	if err != nil {
		return 500, be.APIError{
			Id:      be.InternalServerError.Id,
			Message: "Error updating template data: " + err.Error(),
		}, responseHeader
	}

	return 200, "", responseHeader
}

func (resource TemplateDataResource) Delete(request *be.APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, be.NotLoggedInError, responseHeader
	}
	if request.User.Staff != true {
		return 401, be.StaffOnlyError, responseHeader
	}

	uuid, _ := request.PathValues["uuid"]
	name, _ := request.PathValues["name"]

	template, err := apiDB.FindTemplateRecord(uuid, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_template",
			Message: "No such template: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}

	templateData, err := apiDB.FindTemplateDataRecord(template.Id, name, request.DBInfo)
	if err != nil {
		return 404, be.APIError{
			Id:      "no_such_template_data",
			Message: "No such template data: " + uuid + ", " + name,
			Error:   err.Error(),
		}, responseHeader
	}

	err = apiDB.DeleteTemplateDataRecord(templateData.Id, request.DBInfo)
	if err != nil {
		return http.StatusInternalServerError, be.APIError{
			Id:      "deletion_error",
			Message: "Could not delete the record: " + err.Error(),
		}, responseHeader
	}
	err = request.FS.Delete(templateData.Key, "")
	if err != nil {
		logger.Println("Ignored error deleting template data file: " + templateData.Key + ": " + err.Error())
	}
	return 200, "{}", responseHeader
}

func etagForTemplateData(templateData *apiDB.TemplateDataRecord, version string) []string {
	return []string{"template-data-" + version + "-" + templateData.Key}
}
