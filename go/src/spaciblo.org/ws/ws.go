/*
Package ws implements a WebSocket service for browser clients of Spaciblō spaces
*/
package ws

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/nu7hatch/gouuid"

	"spaciblo.org/be"
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
	WSPort     int64
	SimHost    string
	CertPath   string // file path to a TLS cert
	KeyPath    string // file path to a TLs key
	WSHandler  *WebSocketHandler
	WSListener *be.StoppableListener

	RPCPort   int64
	RPCServer *RPCHostServer
}

func NewWSService(wsPort int64, simHost string, rpcPort int64, certPath string, keyPath string) (*WSService, error) {
	service := &WSService{
		WSPort:   wsPort,
		SimHost:  simHost,
		CertPath: certPath,
		KeyPath:  keyPath,

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
			logger.Println("Exited WS RPC service", err)
		}
	}()

	go func() {
		stoppableListener, err := be.NewStoppableListener(fmt.Sprintf(":%d", wsService.WSPort), wsService.CertPath, wsService.KeyPath)
		if err != nil {
			logger.Println("Error creating WS listener", err)
			return
		}
		wsService.WSListener = stoppableListener

		mux := http.NewServeMux()
		mux.Handle(WS_HTTP_PATH, wsService.WSHandler)
		server := http.Server{
			Handler: mux,
		}
		err = server.Serve(stoppableListener)
		if err != nil {
			logger.Println("Exited WS HTTP service", err)
		}
	}()
}

func (wsService *WSService) Stop() {
	wsService.WSListener.Stop()
	wsService.RPCServer.RPCServer.Stop()
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

	certPath := os.Getenv("TLS_CERT")
	if certPath == "" {
		return errors.New("No TLS_CERT env variable")
	}
	keyPath := os.Getenv("TLS_KEY")
	if keyPath == "" {
		return errors.New("No TLS_KEY env variable")
	}

	logger.Print("WS_PORT:\t\t", wsPort)
	logger.Print("WS_RPC_PORT:\t", rpcPort)
	logger.Print("SIM_HOST:\t\t", simHost)
	logger.Print("TLS_CERT:\t\t", certPath)
	logger.Print("TLS_KEY:\t\t", keyPath)

	wsService, err := NewWSService(wsPort, simHost, rpcPort, certPath, keyPath)
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
