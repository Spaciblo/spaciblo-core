package be

import (
	"encoding/json"
	"errors"
	"io/ioutil"
	"log"
	"mime"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/nu7hatch/gouuid"
)

var logger = log.New(os.Stdout, "[be] ", 0)

func UUID() string {
	u4, _ := uuid.NewV4()
	return u4.String()
}

func MimeTypeFromFileName(name string) string {
	lindex := strings.LastIndex(name, ".")
	if lindex == -1 || lindex == len(name)-1 {
		return ""
	}
	return mime.TypeByExtension(name[lindex:])
}

func EtcdGet(host string, path string) (string, error) {
	url := "http://" + host + ":4001" + path
	resp, err := http.Get(url)
	if err != nil {
		logger.Print("Error fetching " + url)
		return "", err
	}
	if resp.StatusCode != 200 {
		logger.Print("Error fetching " + url)
		return "", errors.New("Non 200 status code: " + strconv.Itoa(resp.StatusCode))
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		logger.Print("Error fetching " + url)
		return "", err
	}

	var etcdResponse EtcdResponse
	err = json.NewDecoder(strings.NewReader(string(body))).Decode(&etcdResponse)
	if err != nil {
		logger.Print("Could not parse the etcd data: " + string(body))
		return "", err
	}
	return etcdResponse.Node.Value, nil
}

type EtcdNode struct {
	Key   string `json:key`
	Value string `json:value`
}

type EtcdResponse struct {
	Action string   `json:action`
	Node   EtcdNode `json:node`
}
