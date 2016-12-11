/*
Package ws implements a WebSocket service for browser clients of Spaciblō spaces
*/
package ws

import (
	"errors"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/nu7hatch/gouuid"
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
	rpcPort, err := strconv.ParseInt(os.Getenv("WS_RPC_PORT"), 10, 64)
	if err != nil {
		logger.Panic("No WS_RPC_PORT env variable")
		return err
	}

	simHost := os.Getenv("SIM_HOST")
	if simHost == "" {
		logger.Panic("Invalid SIM_HOST env variable")
		return errors.New("WS requires a SIM_HOST variable")
	}

	logger.Print("WS_PORT:\t\t", port)
	logger.Print("WS_RPC_PORT:\t", rpcPort)
	logger.Print("SIM_HOST:\t\t", simHost)

	handler, err := NewWebSocketHandler(simHost)
	if err != nil {
		logger.Panic("Failed to create the WS service")
		return err
	}

	hostServer, err := newHostServer(handler)
	if err != nil {
		return errors.New("WSHostServer initialization Error: " + err.Error())
	}
	go func() {
		err := hostServer.Serve(rpcPort)
		if err != nil {
			logger.Fatal("Could not start WS RPC service")
		}
	}()

	http.Handle(WS_HTTP_PATH, handler)
	if err := http.ListenAndServe(":"+strconv.FormatInt(port, 10), nil); err != nil {
		log.Fatal("ListenAndServe:", err)
		return err
	}
	return nil
}

func UUID() string {
	u4, _ := uuid.NewV4()
	return u4.String()
}
