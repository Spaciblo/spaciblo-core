package be

import (
	"net/http"
)

// SchemaAPI is a JSON data struct with info about the API
type SchemaAPI struct {
	Version string `json:"version"`
}

// Schema is a JSON data struct for the API's schema
type Schema struct {
	API       SchemaAPI  `json:"api"`
	Endpoints []Endpoint `json:"endpoints"`
}

// Endpoint is a JSON data struct representing an API endpoint
type Endpoint struct {
	Name        string     `json:"name"`
	Path        string     `json:"path"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Properties  []Property `json:"properties"`
}

// Property is a JSON data struct representing a field of an API endpoint
type Property struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	DataType     string `json:"data-type"`               // string, long-string, int, float, array, object, bool, timestamp, file, image
	Optional     bool   `json:"optional"`                // true if the property is not required
	FileType     string `json:"file-type,omitempty"`     // If this property is a file, this is the resource name
	ChildrenType string `json:"children-type,omitempty"` // If this endpoint is a collection, this is the type
	Protected    bool   `json:"protected"`               // True if it is not usually edited by people
}

// SchemaResource is the API resource which describes the API
type SchemaResource struct {
	api *API
}

func NewSchemaResource(api *API) *SchemaResource {
	return &SchemaResource{
		api: api,
	}
}

func (SchemaResource) Name() string  { return "schema" }
func (SchemaResource) Path() string  { return "/schema" }
func (SchemaResource) Title() string { return "API Schema" }
func (SchemaResource) Description() string {
	return "Use this JSON schema to implement your front end API wrapper."
}

var SchemaProperties = []Property{
	Property{
		Name:        "api",
		Description: "Information about this web API",
		DataType:    "object",
	},
	Property{
		Name:        "endpoints",
		Description: "A list of the endpoints in this API",
		DataType:    "array",
	},
}

func (sr SchemaResource) Properties() []Property {
	return SchemaProperties
}

func (sr SchemaResource) Get(request *APIRequest) (int, interface{}, http.Header) {
	header := map[string][]string{}
	endpoints := make([]Endpoint, len(sr.api.resources))
	for i, resource := range sr.api.resources {
		endpoints[i] = endpointFromResource(resource, sr.api.Path)
	}
	schemaAPI := SchemaAPI{
		Version: sr.api.Version,
	}
	schema := Schema{
		API:       schemaAPI,
		Endpoints: endpoints,
	}
	return 200, schema, header
}

func endpointFromResource(resource Resource, apiPath string) Endpoint {
	endpoint := Endpoint{
		Name:        resource.Name(),
		Path:        apiPath + resource.Path(),
		Title:       resource.Title(),
		Description: resource.Description(),
		Properties:  resource.Properties(),
	}
	return endpoint
}
