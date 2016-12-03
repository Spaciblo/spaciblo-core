/*
Package ws implements a WebSocket service for browser clients of Spaciblō spaces
*/
package ws

import (
	"log"
	"net/http"
	"os"
	"strconv"
)

var logger = log.New(os.Stdout, "[ws] ", 0)

// WebSockets connect to this service at URLs like "ws://<host>:<port>/ws"
const WS_HTTP_PATH = "/ws"

// StartWS creates the WebSocket service, then listens and serves (does not return)
func StartWS() error {
	port, err := strconv.ParseInt(os.Getenv("WS_PORT"), 10, 64)
	if err != nil {
		logger.Panic("No WS_PORT env variable")
		return err
	}
	logger.Print("WS_PORT:\t\t", port)
	http.Handle(WS_HTTP_PATH, NewWebSocketHandler())
	if err := http.ListenAndServe(":"+strconv.FormatInt(port, 10), nil); err != nil {
		log.Fatal("ListenAndServe:", err)
		return err
	}
	return nil
}
