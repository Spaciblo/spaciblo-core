/*
Package sim provides the 3D space simulations' host service.

Communication with the sim service from the ws and api services is via gRPC.
*/
package sim

import (
	"errors"
	"log"
	"net"
	"os"
	"strconv"

	"google.golang.org/grpc"

	"spaciblo.org/be"
	"spaciblo.org/db"
	simRPC "spaciblo.org/sim/rpc"
)

var logger = log.New(os.Stdout, "[sim-host] ", 0)

/*
SimHostService holds references to the RPC server and space simulations that make up the sim host service
*/
type SimHostService struct {
	RPCPort   int64
	WSHost    string
	RPCServer *grpc.Server
	SimServer *SimHostServer
	DBInfo    *be.DBInfo
}

func NewSimHostService(rpcPort int64, wsHost string, dbInfo *be.DBInfo) (*SimHostService, error) {
	service := &SimHostService{
		RPCPort: rpcPort,
		WSHost:  wsHost,
		DBInfo:  dbInfo,
	}
	simHostServer, err := NewSimHostServer(service.WSHost, service.DBInfo)
	if err != nil {
		return nil, err
	}
	service.SimServer = simHostServer

	var opts []grpc.ServerOption
	service.RPCServer = grpc.NewServer(opts...)

	return service, nil
}

/*
Start runs the RPC service in a go routine
(does not block)
*/
func (service *SimHostService) Start() error {
	go func() {
		listener, err := net.Listen("tcp", ":"+strconv.FormatInt(service.RPCPort, 10))
		if err != nil {
			logger.Println("Error opening RPC listener in sim host", err)
			return
		}
		simRPC.RegisterSimHostServer(service.RPCServer, service.SimServer)
		err = service.RPCServer.Serve(listener)
		if err != nil {
			// TODO is there a way to figure out whether this happened because we closed the socket?
			_, ok := err.(net.Error)
			if ok == false {
				logger.Println("Non-network error serving RPC in sim host", err)
			}
			return
		}
		logger.Println("Sim stopped")
	}()
	return nil
}

func (service *SimHostService) Stop() {
	service.RPCServer.Stop()
}

/*
Gather the env variables and start the sim host.
Blocks while servicing requests.
*/
func StartSimHostFromEnvVariables() error {
	rpcPort, err := strconv.ParseInt(os.Getenv("SIM_PORT"), 10, 64)
	if err != nil {
		return err
	}
	logger.Print("SIM_PORT:\t\t", rpcPort)

	wsHost := os.Getenv("WS_RPC_HOST")
	if wsHost == "" {
		return errors.New("Invalid WS_RPC_HOST env variable")
	}
	logger.Print("WS_RPC_HOST:\t", wsHost)

	dbInfo, err := db.InitDB()
	if err != nil {
		return err
	}
	service, err := NewSimHostService(rpcPort, wsHost, dbInfo)
	if err != nil {
		return err
	}
	service.Start()
	return nil
}
