package main

import (
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/goincremental/negroni-sessions"
	"github.com/goincremental/negroni-sessions/cookiestore"
	"github.com/urfave/negroni"

	"spaciblo.org/be"
)

// VERSION is the API version
var VERSION = "0.1.0"

var logger = log.New(os.Stdout, "[api] ", 0)

func main() {
	// Get the required environment variables
	port, err := strconv.ParseInt(os.Getenv("PORT"), 10, 64)
	if err != nil {
		logger.Panic("No PORT env variable")
		return
	}
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		logger.Panic("No STATIC_DIR env variable")
		return
	}
	fsDir := os.Getenv("FILE_STORAGE_DIR")
	if fsDir == "" {
		logger.Panic("No FILE_STORAGE_DIR env variable")
		return
	}
	sessionSecret := os.Getenv("SESSION_SECRET")
	if sessionSecret == "" {
		logger.Panic("No SESSION_SECRET env variable")
		return
	}
	frontEndDir := os.Getenv("FRONT_END_DIR") // Optional

	logger.Print("PORT:\t\t", port)
	logger.Print("STATIC_DIR:\t", staticDir)
	logger.Print("FRONT_END_DIR:\t", frontEndDir)
	logger.Print("FILE_STORAGE_DIR:\t", fsDir)
	logger.Print("DB host: ", be.DBHost, ":", be.DBPort)

	err = be.InitDB()
	if err != nil {
		logger.Panic("DB Registration Error: " + err.Error())
		return
	}

	fs, err := be.NewLocalFileStorage(fsDir)
	if err != nil {
		logger.Panic("Could not open file storage directory: " + fsDir)
		return
	}

	server := negroni.New()
	store := cookiestore.New([]byte(sessionSecret))
	server.Use(sessions.Sessions(be.AuthCookieName, store))

	if frontEndDir != "" {
		feStatic := negroni.NewStatic(http.Dir(frontEndDir))
		feStatic.Prefix = ""
		server.Use(feStatic)
	}

	static := negroni.NewStatic(http.Dir(staticDir))
	static.Prefix = "/api/static"
	server.Use(static)

	api := be.NewAPI("/api/"+VERSION, VERSION, fs)

	server.UseHandler(api.Mux)
	server.Run(":" + strconv.FormatInt(port, 10))
}
