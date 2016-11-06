package be

import (
	"fmt"

	"encoding/json"
	"net/http"
)

var UserProperties = []Property{
	Property{
		Name:        "uuid",
		Description: "uuid",
		DataType:    "string",
		Protected:   true,
	},
	Property{
		Name:        "email",
		Description: "email",
		DataType:    "string",
	},
	Property{
		Name:        "first-name",
		Description: "first name",
		DataType:    "string",
		Optional:    true,
	},
	Property{
		Name:        "last-name",
		Description: "last name",
		DataType:    "string",
		Optional:    true,
	},
	Property{
		Name:        "created-at",
		Description: "Created timestamp",
		DataType:    "date-time",
		Optional:    true,
		Protected:   true,
	},
	Property{
		Name:        "updated-at",
		Description: "Modified timestamp",
		DataType:    "date-time",
		Optional:    true,
		Protected:   true,
	},
}

var UsersProperties = NewAPIListProperties("user")

var UserImageProperties = []Property{
	Property{
		Name:        "image",
		Description: "The multipart form encoded image representing a user",
		DataType:    "file",
		Optional:    false,
	},
}

type LoginData struct {
	Email    string "json:email"
	Password string "json:password"
}

/*
CurrentUserImageResource returns a image the authenticated request.User has a non-empty `image` field
*/
type CurrentUserImageResource struct{}

func NewCurrentUserImage() *CurrentUserImageResource {
	return &CurrentUserImageResource{}
}

func (CurrentUserImageResource) Name() string                    { return "current-user-image" }
func (CurrentUserImageResource) Path() string                    { return "/user/current/image" }
func (CurrentUserImageResource) Title() string                   { return "User image" }
func (CurrentUserImageResource) Description() string             { return "The image for the authenticated user." }
func (resource CurrentUserImageResource) Properties() []Property { return UserImageProperties }

func (resource CurrentUserImageResource) Get(request *APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, NotLoggedInError, responseHeader
	}
	if request.User.Image == "" {
		return 404, FileNotFoundError, responseHeader
	}
	// TODO This size should be set via URL params
	imageFile, err := FitCrop(700, 700, request.User.Image, request.FS)
	if err != nil {
		logger.Print("Error with fit crop ", err.Error())
		return 500, &APIError{
			Id:      InternalServerError.Id,
			Message: "Error reading user image: " + request.User.Image + ": " + err.Error(),
		}, responseHeader
	}
	err = request.ServeImage(imageFile)
	if err != nil {
		return 500, &APIError{
			Id:      InternalServerError.Id,
			Message: "Error serving image file: " + err.Error(),
		}, responseHeader
	}

	// Indicate that the response is complete and not to process it like the usual JSON response
	return StatusInternallyHandled, nil, nil
}

func (resource CurrentUserImageResource) PutForm(request *APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, NotLoggedInError, responseHeader
	}

	file, fileHeader, err := request.Raw.FormFile("image")
	if err != nil {
		return http.StatusBadRequest, &APIError{
			Id:      "bad_request",
			Message: "An `image` field is required up update your user image",
		}, responseHeader
	}
	fileKey, err := request.FS.Put(fileHeader.Filename, file)
	if err != nil {
		return http.StatusInternalServerError, &APIError{
			Id:      "storage_error",
			Message: "Could not store the file: " + err.Error(),
		}, responseHeader
	}

	oldFileKey := request.User.Image
	request.User.Image = fileKey
	err = UpdateUser(request.User, request.DB)
	if err != nil {
		return http.StatusInternalServerError, &APIError{
			Id:      "database_error",
			Message: "Could not update the user: " + err.Error(),
		}, responseHeader
	}
	if oldFileKey != "" {
		err = request.FS.Delete(oldFileKey, "")
		if err != nil {
			logger.Print("Could not delete old image: " + err.Error())
		}
	}
	return 200, "Ok", responseHeader
}

/*
CurrentUserResource returns a user if the GET request is authenticated, otherwise a 404 NotLoggedInError
*/
type CurrentUserResource struct {
}

func NewCurrentUserResource() *CurrentUserResource {
	return &CurrentUserResource{}
}

func (CurrentUserResource) Name() string  { return "current-user" }
func (CurrentUserResource) Path() string  { return "/user/current" }
func (CurrentUserResource) Title() string { return "Current user" }
func (CurrentUserResource) Description() string {
	return "The User in the requesting session."
}

func (resource CurrentUserResource) Properties() []Property {
	return UserProperties
}

func etagForUser(user *User, version string) []string {
	return []string{"user-" + version + "-" + fmt.Sprintf("%d", user.Updated.UnixNano())}
}

func (resource CurrentUserResource) Get(request *APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 404, NotLoggedInError, responseHeader
	}
	responseHeader["Etag"] = etagForUser(request.User, request.Version)
	return 200, request.User, responseHeader
}

func (resource CurrentUserResource) Delete(request *APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 200, "Ok", responseHeader
	}
	// Instead of clearing the session, which leaves behind a cookie, we delete the entire cookie
	// Since the cookie is opaque to the client, deleting it makes it easy for the client to decide whether it is authenticated.
	http.SetCookie(request.Writer, &http.Cookie{
		Name:   AuthCookieName,
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})
	return 200, "Ok", responseHeader
}

func (resource CurrentUserResource) Post(request *APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	var loginData LoginData
	err := json.NewDecoder(request.Raw.Body).Decode(&loginData)
	if err != nil {
		return 400, JSONParseError, responseHeader
	}
	if loginData.Email == "" || loginData.Password == "" {
		return 400, UnprocessableError, responseHeader
	}
	user, err := FindUserByEmail(loginData.Email, request.DB)
	if err != nil {
		return 400, APIError{
			Id:      "no_such_user",
			Message: "No such user",
			Error:   err.Error(),
		}, responseHeader
	}
	if PasswordMatches(user.Id, loginData.Password, request.DB) == false {
		return 400, APIError{
			Id:      "incorrect_password",
			Message: "Incorrect password",
		}, responseHeader
	}
	request.Session.Set(UserUUIDKey, user.UUID)
	return 200, user, responseHeader
}

type UserResource struct {
}

func NewUserResource() *UserResource {
	return &UserResource{}
}

func (UserResource) Name() string  { return "user" }
func (UserResource) Path() string  { return "/user/{uuid:[0-9,a-z,-]+}" }
func (UserResource) Title() string { return "User" }
func (UserResource) Description() string {
	return "Each account is associated with a User."
}

func (resource UserResource) Properties() []Property {
	return UserProperties
}

func (resource UserResource) Get(request *APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, NotLoggedInError, responseHeader
	}
	if request.User.Staff != true {
		return 403, ForbiddenError, responseHeader
	}

	uuid, _ := request.PathValues["uuid"]
	user, err := FindUser(uuid, request.DB)
	if err != nil {
		return 404, APIError{
			Id:      "no_such_user",
			Message: "No such user: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}
	responseHeader["Etag"] = etagForUser(user, request.Version)
	return 200, user, responseHeader
}

func (resource UserResource) Put(request *APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, NotLoggedInError, responseHeader
	}
	uuid, _ := request.PathValues["uuid"]
	user, err := FindUser(uuid, request.DB)
	if err != nil {
		return 404, APIError{
			Id:      "no_such_user",
			Message: "No such user: " + uuid,
			Error:   err.Error(),
		}, responseHeader
	}
	if request.User.Staff != true && request.User.UUID != user.UUID {
		return 403, ForbiddenError, responseHeader
	}

	var updatedUser User
	err = json.NewDecoder(request.Raw.Body).Decode(&updatedUser)
	if err != nil {
		return 400, BadRequestError, responseHeader
	}
	if user.UUID != updatedUser.UUID {
		return 400, BadRequestError, responseHeader
	}
	if user.Id != updatedUser.Id {
		return 400, BadRequestError, responseHeader
	}
	// Some fields cannot be updated via this API endpoint
	updatedUser.Image = user.Image
	updatedUser.Created = user.Created
	// Some fields can only be updated by staff
	if request.User.Staff == false {
		updatedUser.Staff = user.Staff
		updatedUser.Email = user.Email
	}
	err = UpdateUser(&updatedUser, request.DB)
	if err != nil {
		return 400, BadRequestError, responseHeader
	}
	return 200, updatedUser, responseHeader
}

type UsersResource struct {
}

func NewUsersResource() *UsersResource {
	return &UsersResource{}
}

func (UsersResource) Name() string  { return "users" }
func (UsersResource) Path() string  { return "/user/" }
func (UsersResource) Title() string { return "Users" }
func (UsersResource) Description() string {
	return "A list of users."
}

func (resource UsersResource) Properties() []Property {
	return UsersProperties
}

func (resource UsersResource) Get(request *APIRequest) (int, interface{}, http.Header) {
	responseHeader := map[string][]string{}
	if request.User == nil {
		return 401, NotLoggedInError, responseHeader
	}
	if request.User.Staff != true {
		return 403, ForbiddenError, responseHeader
	}

	offset, limit := GetOffsetAndLimit(request.Raw.Form)
	users, err := FindUsers(offset, limit, request.DB)
	if err != nil {
		return 500, APIError{
			Id:      "db_error",
			Message: "Database error",
			Error:   err.Error(),
		}, responseHeader
	}
	list := &APIList{
		Offset:  offset,
		Limit:   limit,
		Objects: users,
	}
	return 200, list, responseHeader
}
