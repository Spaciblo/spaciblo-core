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

/*
WSService holds references to the HTTP and gRPC services that make up the WS service
HTTP WebSocket connections come in from browsers
gRPC calls come in from the sim host
The HTTP service itself holds a gRPC client to the sim host
*/
type WSService struct {
	WSPort    int64
	SimHost   string
	WSHandler *WebSocketHandler

	RPCPort   int64
	RPCServer *RPCHostServer
}

func NewWSService(wsPort int64, simHost string, rpcPort int64) (*WSService, error) {
	service := &WSService{
		WSPort:  wsPort,
		SimHost: simHost,

		RPCPort: rpcPort,
	}

	wsHandler, err := NewWebSocketHandler(simHost)
	if err != nil {
		return nil, err
	}
	service.WSHandler = wsHandler

	rpcHostServer, err := NewRPCHostServer(wsHandler)
	if err != nil {
		return nil, err
	}
	service.RPCServer = rpcHostServer

	return service, nil
}

/*
Start opens the listeners and begins HTTP and gRPC service in two separate goroutines
(does not block)
*/
func (wsService *WSService) Start() {
	go func() {
		err := wsService.RPCServer.Serve(wsService.RPCPort)
		if err != nil {
			logger.Println("Could not start WS RPC service", err)
		}
	}()

	go func() {
		http.Handle(WS_HTTP_PATH, wsService.WSHandler)
		err := http.ListenAndServe(":"+strconv.FormatInt(wsService.WSPort, 10), nil)
		if err != nil {
			logger.Println("Could not start WS HTTP service", err)
		}
	}()
}

func (wsService *WSService) Stop() {
	// TODO
}

/*
StartWSFromEnvVariables uses environment variables to create and start the WebSocket service
*/
func StartWSFromEnvVariables() error {
	wsPort, err := strconv.ParseInt(os.Getenv("WS_PORT"), 10, 64)
	if err != nil {
		logger.Println("No WS_PORT env variable")
		return err
	}

	rpcPort, err := strconv.ParseInt(os.Getenv("WS_RPC_PORT"), 10, 64)
	if err != nil {
		logger.Println("No WS_RPC_PORT env variable")
		return err
	}

	simHost := os.Getenv("SIM_HOST")
	if simHost == "" {
		logger.Println("Invalid SIM_HOST env variable")
		return errors.New("WS requires a SIM_HOST variable")
	}

	logger.Print("WS_PORT:\t\t", wsPort)
	logger.Print("WS_RPC_PORT:\t", rpcPort)
	logger.Print("SIM_HOST:\t\t", simHost)

	wsService, err := NewWSService(wsPort, simHost, rpcPort)
	if err != nil {
		logger.Println("Could not start WS services", err)
		return err
	}
	wsService.Start()
	return nil
}

func UUID() string {
	u4, _ := uuid.NewV4()
	return u4.String()
}
