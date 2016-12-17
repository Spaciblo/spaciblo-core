package be

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strconv"
)

// Client interacts with the back end web API
type Client struct {
	BaseURL string
	Schema  Schema
	Session string
	User    User
}

/*
NewClient creates a client for interacting with the back end web API
baseURL: a fully qualified URL to the API like https://127.0.0.1:9000/api/0.1.0
*/
func NewClient(baseURL string) (*Client, error) {
	client := &Client{
		BaseURL: baseURL,
	}
	err := client.fetchSchema()
	if err != nil {
		return nil, err
	}
	return client, nil
}

func (client *Client) Authenticate(email string, password string) error {
	// Post the login info
	loginData := LoginData{
		Email:    email,
		Password: password,
	}
	resp, err := client.PostJSON("/user/current", loginData)
	if err != nil {
		return err
	}

	// Look for the session cookie
	cookies := resp.Cookies()
	for _, cookie := range cookies {
		if cookie.Name == TestSessionCookie {
			client.Session = cookie.Value
		}
	}
	if client.Session == "" {
		return errors.New("No session cookie on the authentication response")
	}

	// Read the User data
	defer resp.Body.Close()
	err = json.NewDecoder(resp.Body).Decode(&client.User)
	if err != nil {
		return err
	}
	return nil
}

func (client *Client) Deauthenticate() error {
	if client.Session == "" {
		return nil
	}
	client.Session = ""
	req, err := client.prepJSONRequest("DELETE", client.BaseURL+"/user/current", nil)
	if err != nil {
		return err
	}
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	c := &http.Client{
		Transport: transport,
	}
	_, err = c.Do(req)
	if err != nil {
		return err
	}
	return nil
}

func (client *Client) GetList(url string) (*APIList, error) {
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	c := &http.Client{
		Transport: transport,
	}
	req, err := client.prepJSONRequest("GET", client.BaseURL+url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != 200 {
		return nil, errors.New("Non-200 error " + strconv.Itoa(resp.StatusCode) + " getting list from " + url)
	}
	defer resp.Body.Close()
	list := new(APIList)
	err = json.NewDecoder(resp.Body).Decode(list)
	if err != nil {
		return nil, err
	}
	return list, nil
}

func (client *Client) Delete(url string) error {
	req, err := client.prepRequest("DELETE", client.BaseURL+url, nil, "")
	if err != nil {
		return err
	}
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	c := &http.Client{
		Transport: transport,
	}
	resp, err := c.Do(req)
	if err != nil {
		return err
	}
	if resp.StatusCode != 200 {
		return errors.New("Non-200 error " + strconv.Itoa(resp.StatusCode) + " deleting " + url)
	}
	return nil
}

func (client *Client) GetJSON(url string, target interface{}) error {
	req, err := client.prepJSONRequest("GET", client.BaseURL+url, nil)
	if err != nil {
		return err
	}
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	c := &http.Client{
		Transport: transport,
	}
	resp, err := c.Do(req)
	if err != nil {
		return err
	}
	if resp.StatusCode != 200 {
		return errors.New("Non-200 error " + strconv.Itoa(resp.StatusCode) + " getting JSON from " + url)
	}
	// Read the User data
	defer resp.Body.Close()
	err = json.NewDecoder(resp.Body).Decode(target)
	if err != nil {
		return err
	}
	return nil
}

func (client *Client) GetFile(url string) (io.Reader, error) {
	req, err := client.prepRequest("GET", client.BaseURL+url, nil, "")
	if err != nil {
		return nil, err
	}
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	c := &http.Client{
		Transport: transport,
	}
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != 200 {
		return nil, errors.New("Non-200 error " + strconv.Itoa(resp.StatusCode) + " getting file from " + url)
	}
	return resp.Body, nil
}

func (client *Client) SendFile(method string, url string, fieldName string, file *os.File) (resp *http.Response, err error) {
	var buff bytes.Buffer
	writer := multipart.NewWriter(&buff)
	ffWriter, err := writer.CreateFormFile(fieldName, file.Name())
	if err != nil {
		return nil, err
	}
	if _, err = io.Copy(ffWriter, file); err != nil {
		return nil, err
	}
	writer.Close()

	req, err := http.NewRequest(method, client.BaseURL+url, &buff)
	if err != nil {
		return nil, err
	}
	req.Header.Add("Accept", AcceptHeaderPrefix+client.Schema.API.Version)
	if client.Session != "" {
		req.AddCookie(&http.Cookie{
			Name:  TestSessionCookie,
			Value: client.Session,
		})
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	httpClient := &http.Client{
		Transport: transport,
	}
	return httpClient.Do(req)
}

func (client *Client) PostJSON(url string, data interface{}) (resp *http.Response, err error) {
	return client.SendJSON("POST", url, data)
}

func (client *Client) PostAndReceiveJSON(url string, data interface{}, target interface{}) (err error) {
	return client.SendAndReceiveJSON("POST", url, data, target)
}

func (client *Client) PutAndReceiveJSON(url string, data interface{}, target interface{}) (err error) {
	return client.SendAndReceiveJSON("PUT", url, data, target)
}

func (client *Client) SendAndReceiveJSON(method string, url string, data interface{}, target interface{}) (err error) {
	response, err := client.SendJSON(method, url, data)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	err = json.NewDecoder(response.Body).Decode(target)
	if err != nil {
		return err
	}
	return nil

}

func (client *Client) PutJSON(url string, data interface{}) (resp *http.Response, err error) {
	return client.SendJSON("PUT", url, data)
}

func (client *Client) SendJSON(method string, url string, data interface{}) (resp *http.Response, err error) {
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	c := &http.Client{
		Transport: transport,
	}
	dataBuff, err := json.Marshal(data)
	if err != nil {
		return
	}
	req, err := client.prepJSONRequest(method, client.BaseURL+url, dataBuff)
	if err != nil {
		return
	}
	resp, err = c.Do(req)
	if err != nil {
		return
	}
	if resp.StatusCode != 200 {
		return resp, errors.New("Non-200 error " + strconv.Itoa(resp.StatusCode) + " " + method + "ing JSON to " + url)
	}
	return
}

/*
UpdateUser and the other *User functions are good examples of how to use the Client
They use only the public API so you should be able to copy the patterns for your own purposes
*/
func (client *Client) UpdateUser(user *User) error {
	resp, err := client.PutJSON("/user/"+user.UUID, user)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	err = json.NewDecoder(resp.Body).Decode(user)
	if err != nil {
		return err
	}
	return nil
}

func (client *Client) UpdateUserImage(imageFile *os.File) error {
	response, err := client.SendFile("PUT", "/user/current/image", "image", imageFile)
	if err != nil {
		return err
	}
	if response.StatusCode != 200 {
		return errors.New("Non-200 error code: " + strconv.Itoa(response.StatusCode))
	}
	return nil
}

func (client *Client) prepJSONRequest(method string, url string, data []byte) (req *http.Request, err error) {
	if data == nil {
		return client.prepRequest(method, url, nil, "application/json")
	}
	return client.prepRequest(method, url, bytes.NewReader(data), "application/json")
}

func (client *Client) prepRequest(method string, url string, reader io.Reader, mimetype string) (req *http.Request, err error) {
	if reader == nil {
		req, err = http.NewRequest(method, url, nil)
	} else {
		req, err = http.NewRequest(method, url, reader)
	}
	if err != nil {
		return nil, err
	}
	if mimetype != "" {
		req.Header.Add("Content-Type", mimetype)
	}
	req.Header.Add("Accept", AcceptHeaderPrefix+client.Schema.API.Version)
	if client.Session != "" {
		req.AddCookie(&http.Cookie{
			Name:  TestSessionCookie,
			Value: client.Session,
		})
	}
	return req, nil
}

func (client *Client) fetchSchema() error {
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	c := &http.Client{
		Transport: transport,
	}
	req, err := http.NewRequest("GET", client.BaseURL+"/schema", nil)
	resp, err := c.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	err = json.NewDecoder(resp.Body).Decode(&client.Schema)
	if err != nil {
		return err
	}
	return nil
}
