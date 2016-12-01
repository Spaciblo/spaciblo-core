package be

/*
	The Resource and API functionality.
*/

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/goincremental/negroni-sessions"
	"github.com/gorilla/mux"
)

// GET and the other HTTP methods
const (
	GET    = "GET"
	POST   = "POST"
	PUT    = "PUT"
	DELETE = "DELETE"
	HEAD   = "HEAD"
	PATCH  = "PATCH"
)

// AuthCookieName and UserUUID are used by the session mechanism
const (
	AuthCookieName string = "be_auth"
	FlagCookieName string = "be_email"
	UserUUIDKey    string = "user-uuid"
)

// OffsetKey and LimitKey are list URL parameters
const (
	OffsetKey string = "offset"
	LimitKey  string = "limit"
)

// AcceptHeaderPrefix should be followed by the version in the Accept header of requests
const (
	AcceptHeaderPrefix = "application/vnd.api+json; version="
)

// StatusInternallyHandled is the signal from an API handler function (e.g. Get(...)) that the request has been fully handled internally and does not require the back end to serialize JSON or other such work.
const (
	StatusInternallyHandled = 0
)

// APIListProperties are the properties any resource which is a list
var APIListProperties = []Property{
	Property{
		Name:        "offset",
		Description: "The index into the result set for the first item in this list",
		DataType:    "int",
	},
	Property{
		Name:        "limit",
		Description: "The maximum number of results returned",
		DataType:    "int",
	},
	Property{
		Name:        "objects",
		Description: "The array of objects in this list",
		DataType:    "array",
	},
}

// NewAPIListProperties generates a Property array using the default values in APIListProperties
func NewAPIListProperties(childrenType string) []Property {
	var props = make([]Property, len(APIListProperties))
	for index, property := range APIListProperties {
		props[index] = property
		if props[index].Name == "objects" {
			props[index].ChildrenType = childrenType
		}
	}
	return props
}

/*
APIList is a data structure used when returning a list from an API resource
*/
type APIList struct {
	Offset  int         `json:"offset"`
	Limit   int         `json:"limit"`
	Objects interface{} `json:"objects"`
}

/*
GetOffsetAndLimit find the range values from a request's url.Values
By default, return 0, 100
If limit and offset are set in the values, return those
*/
func GetOffsetAndLimit(values url.Values) (offset int, limit int) {
	offsetVal, err := strconv.Atoi(values.Get(OffsetKey))
	if err == nil {
		offset = offsetVal
	} else {
		offset = 0
	}
	limitVal, err := strconv.Atoi(values.Get(LimitKey))
	if err == nil {
		limit = limitVal
	} else {
		limit = 100
	}
	return
}

/*
APIRequest is data for a request to an API endpoint
*/
type APIRequest struct {
	PathValues map[string]string
	DBInfo     *DBInfo
	FS         FileStorage
	Session    sessions.Session
	User       *User
	Version    string
	Raw        *http.Request
	Writer     http.ResponseWriter
}

/*
Resource is and API resource which handles APIRequests to a given URL endpoint
*/
type Resource interface {
	Name() string        // The name used by the mux
	Path() string        // The path used by the mux
	Title() string       // A human readable name which should be one or two words
	Description() string // A long form, human readable description in Markdown
	Properties() []Property
}

/*
GetSupported and the other interfaces are used by Resources to indicate whether a given HTTP method is supported
*/
type GetSupported interface {
	Get(request *APIRequest) (int, interface{}, http.Header)
}
type PostSupported interface {
	Post(request *APIRequest) (int, interface{}, http.Header)
}
type PostFormSupported interface {
	PostForm(request *APIRequest) (int, interface{}, http.Header)
}
type PutSupported interface {
	Put(request *APIRequest) (int, interface{}, http.Header)
}
type PutFormSupported interface {
	PutForm(request *APIRequest) (int, interface{}, http.Header)
}
type DeleteSupported interface {
	Delete(request *APIRequest) (int, interface{}, http.Header)
}
type HeadSupported interface {
	Head(request *APIRequest) (int, interface{}, http.Header)
}
type PatchSupported interface {
	Patch(request *APIRequest) (int, interface{}, http.Header)
}
type PatchFormSupported interface {
	PatchForm(request *APIRequest) (int, interface{}, http.Header)
}

/*
API collects a tree of Resources, manages the mux, and adds the schema resource
*/
type API struct {
	Mux         *mux.Router
	Path        string
	Version     string
	FileStorage FileStorage
	DBInfo      *DBInfo
	resources   []Resource
}

func NewAPI(path string, version string, fileStorage FileStorage, dbInfo *DBInfo) *API {
	api := &API{
		Mux:         mux.NewRouter(),
		Path:        path,
		Version:     version,
		FileStorage: fileStorage,
		DBInfo:      dbInfo,
		resources:   make([]Resource, 0),
	}
	api.AddResource(NewSchemaResource(api), false)
	api.AddResource(NewCurrentUserResource(), true)
	api.AddResource(NewCurrentUserImage(), false)
	api.AddResource(NewUsersResource(), true)
	api.AddResource(NewUserResource(), true)
	return api
}

func (api *API) AddResource(resource Resource, versioned bool) {
	api.resources = append(api.resources, resource)
	api.Mux.HandleFunc(api.Path+resource.Path(), api.createHandlerFunc(resource, versioned, api.DBInfo)).Name(resource.Name())
}

func (api *API) acceptableAcceptHeader(acceptTypes []string) bool {
	if len(acceptTypes) == 0 {
		return false
	}
	acceptTypes = strings.Split(acceptTypes[0], ",")
	for _, acceptType := range acceptTypes {
		if acceptType == AcceptHeaderPrefix+api.Version {
			return true
		}
	}
	return false
}

/*
	Generate the http.HandlerFunc for a given Resource
*/
func (api *API) createHandlerFunc(resource Resource, versioned bool, dbInfo *DBInfo) http.HandlerFunc {
	isMultipart := func(header http.Header) bool {
		return strings.Index(header.Get("Content-Type"), "multipart/form-data;") == 0
	}

	return func(rw http.ResponseWriter, request *http.Request) {
		if versioned && !api.acceptableAcceptHeader(request.Header["Accept"]) {
			rw.WriteHeader(http.StatusBadRequest)
			errorString, _ := json.Marshal(IncorrectVersionError)
			rw.Write(errorString)
			return
		}
		var methodHandler func(*APIRequest) (int, interface{}, http.Header)
		switch request.Method {
		case GET:
			if resource, ok := resource.(GetSupported); ok {
				methodHandler = resource.Get
			}
		case POST:
			if isMultipart(request.Header) {
				if resource, ok := resource.(PostFormSupported); ok {
					methodHandler = resource.PostForm
				}
			} else {
				if resource, ok := resource.(PostSupported); ok {
					methodHandler = resource.Post
				}
			}
		case PUT:
			if isMultipart(request.Header) {
				if resource, ok := resource.(PutFormSupported); ok {
					methodHandler = resource.PutForm
				}
			} else {
				if resource, ok := resource.(PutSupported); ok {
					methodHandler = resource.Put
				}
			}
		case DELETE:
			if resource, ok := resource.(DeleteSupported); ok {
				methodHandler = resource.Delete
			}
		case HEAD:
			if resource, ok := resource.(HeadSupported); ok {
				methodHandler = resource.Head
			}
		case PATCH:
			if isMultipart(request.Header) {
				if resource, ok := resource.(PatchFormSupported); ok {
					methodHandler = resource.PatchForm
				}
			} else {
				if resource, ok := resource.(PatchSupported); ok {
					methodHandler = resource.Patch
				}
			}
		}
		if methodHandler == nil {
			rw.WriteHeader(http.StatusMethodNotAllowed)
			errorString, _ := json.Marshal(MethodNotAllowedError)
			rw.Write(errorString)
			return
		}

		session := sessions.GetSession(request)

		apiRequest := &APIRequest{
			PathValues: mux.Vars(request),
			DBInfo:     dbInfo,
			FS:         api.FileStorage,
			Session:    sessions.GetSession(request),
			Version:    api.Version,
			Raw:        request,
			Writer:     rw,
		}

		// Fetch the User from the session
		if session != nil {
			sUUID := session.Get(UserUUIDKey)
			if sUUID != nil {
				uuid, _ := sUUID.(string)
				user, err := FindUser(uuid, dbInfo)
				if err == nil {
					apiRequest.User = user
				}
			}
		}

		if isMultipart(request.Header) && request.ParseMultipartForm(1024) != nil {
			rw.WriteHeader(http.StatusBadRequest)
			errorString, _ := json.Marshal(FormParseError)
			rw.Write(errorString)
			return
		}

		rw.Header().Add("API-Version", api.Version)
		rw.Header().Add("Request-Id", UUID()) // Useful for tracking requests across the front and back end
		code, data, header := methodHandler(apiRequest)

		// If the handler signaled that it handled the raw request itself, do nothing more
		if code == StatusInternallyHandled {
			return
		}
		// Not handled internally, so assume that it's the normal JSON API response

		for name, values := range header {
			for _, value := range values {
				rw.Header().Add(name, value)
			}
		}

		content, err := json.Marshal(data)
		if err != nil {
			rw.WriteHeader(http.StatusInternalServerError)
			jError := APIError{
				Id:      "json_serialization_error",
				Message: "JSON serialization error: " + err.Error(),
			}
			errorString, _ := json.Marshal(jError)
			rw.Write(errorString)
			return
		}
		rw.Header().Add("Content-Type", "application/json")

		// Check whether the client's If-None-Match and the response header's ETag match
		if rw.Header().Get("Etag") != "" && rw.Header().Get("Etag") == request.Header.Get("If-None-Match") {
			rw.WriteHeader(http.StatusNotModified)
			return
		}

		rw.WriteHeader(code)
		rw.Write(content)
	}
}

/*
ServeImage responds to the request with the image in imageFile

Callers within API resource method funcs (e.g. Get) should return an internally handled status:
	return StatusInternallyHandled, nil, nil
*/
func (request *APIRequest) ServeImage(imageFile File) error {
	name, err := imageFile.Name()
	if err != nil {
		return err
	}
	size, err := imageFile.Size()
	if err != nil {
		return err
	}
	reader, err := imageFile.Reader()
	if err != nil {
		return err
	}
	request.Raw.Header.Add("Content-Type", MimeTypeFromFileName(name))
	request.Raw.Header.Add("Content-Length", strconv.FormatInt(size, 10))
	_, err = io.Copy(request.Writer, reader)
	if err != nil {
		logger.Printf("Error serving an image but too late to recover %v", err)
	}
	return nil
}
