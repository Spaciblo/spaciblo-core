/*
Package api provides the web APIs for the Spaciblō services.

This does not include the WebSocket services, which are provided by ws.
*/
package api

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/goincremental/negroni-sessions"
	"github.com/goincremental/negroni-sessions/cookiestore"
	"github.com/urfave/negroni"

	"spaciblo.org/be"
	"spaciblo.org/db"
)

// VERSION is the API version
var VERSION = "0.1.0"

var logger = log.New(os.Stdout, "[api] ", 0)

func StartAPI() error {
	// Get the required environment variables
	port, err := strconv.ParseInt(os.Getenv("API_PORT"), 10, 64)
	if err != nil {
		return err
	}
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		return errors.New("No STATIC_DIR env variable")
	}
	fsDir := os.Getenv("FILE_STORAGE_DIR")
	if fsDir == "" {
		return errors.New("No FILE_STORAGE_DIR env variable")
	}
	sessionSecret := os.Getenv("SESSION_SECRET")
	if sessionSecret == "" {
		return errors.New("No SESSION_SECRET env variable")
	}
	docrootEndDir := os.Getenv("DOCROOT_DIR") // Optional

	logger.Print("API_PORT:\t\t", port)
	logger.Print("STATIC_DIR:\t", staticDir)
	logger.Print("DOCROOT_DIR:\t", docrootEndDir)
	logger.Print("FILE_STORAGE_DIR:\t", fsDir)
	logger.Print("DB host: ", be.DBHost, ":", be.DBPort)

	dbInfo, err := db.InitDB()
	if err != nil {
		return errors.New("DB Initialization Error: " + err.Error())
	}
	defer func() {
		dbInfo.Connection.Close()
	}()

	fs, err := be.NewLocalFileStorage(fsDir)
	if err != nil {
		return errors.New("Could not open file storage directory: " + fsDir)
	}

	server := negroni.New()
	store := cookiestore.New([]byte(sessionSecret))
	server.Use(sessions.Sessions(be.AuthCookieName, store))

	if docrootEndDir != "" {
		feStatic := negroni.NewStatic(http.Dir(docrootEndDir))
		feStatic.Prefix = ""
		server.Use(feStatic)
	}

	static := negroni.NewStatic(http.Dir(staticDir))
	static.Prefix = "/api/static"
	server.Use(static)

	api := be.NewAPI("/api/"+VERSION, VERSION, fs, dbInfo)
	addApiResources(api)

	server.UseHandler(api.Mux)

	stoppableListener, err := be.NewStoppableListener("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		return err
	}
	httpServer := http.Server{
		Handler: server,
	}
	httpServer.Serve(stoppableListener)
	return nil
}

func addApiResources(api *be.API) {
	api.AddResource(NewSpacesResource(), true)
	api.AddResource(NewTemplatesResource(), true)
	api.AddResource(NewTemplateResource(), true)
	api.AddResource(NewTemplateDataResource(), false)
	api.AddResource(NewTemplateDataListResource(), true)
}
