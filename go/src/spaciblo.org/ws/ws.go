/*
Package ws implements a WebSocket service for browser clients of Spaciblō spaces
*/
package ws

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
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
	simInfo := strings.Split(os.Getenv("SIM_HOST"), ":")
	simPort, err := strconv.ParseInt(simInfo[1], 10, 64)
	if err != nil {
		logger.Panic("Invalid SIM_HOST env variable")
		return err
	}

	logger.Print("WS_PORT:\t\t", port)
	logger.Print("SIM_HOST:\t\t", simInfo[0])
	logger.Print("SIM_PORT:\t\t", strconv.FormatInt(simPort, 10))

	handler, err := NewWebSocketHandler(simInfo[0], simPort)
	if err != nil {
		logger.Panic("Failed to create the WS service")
		return err
	}
	http.Handle(WS_HTTP_PATH, handler)
	if err := http.ListenAndServe(":"+strconv.FormatInt(port, 10), nil); err != nil {
		log.Fatal("ListenAndServe:", err)
		return err
	}
	return nil
}
