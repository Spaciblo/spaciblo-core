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

	grpc "google.golang.org/grpc"

	"spaciblo.org/db"
	simRPC "spaciblo.org/sim/rpc"
)

var logger = log.New(os.Stdout, "[sim-host] ", 0)

// Gather the env variables and create a SimHostServer, if run is true then start the sims ticking
func StartSimHost(run bool) error {
	port, err := strconv.ParseInt(os.Getenv("SIM_PORT"), 10, 64)
	if err != nil {
		return err
	}
	logger.Print("SIM_PORT:\t\t", port)

	wsHost := os.Getenv("WS_RPC_HOST")
	if wsHost == "" {
		return errors.New("Invalid WS_RPC_HOST env variable")
	}
	logger.Print("WS_RPC_HOST:\t", wsHost)

	dbInfo, err := db.InitDB()
	if err != nil {
		return errors.New("DB Initialization Error: " + err.Error())
	}
	defer func() {
		dbInfo.Connection.Close()
	}()

	simHostServer, err := NewSimHostServer(wsHost, dbInfo, run)
	if err != nil {
		return errors.New("SimHostServer initialization Error: " + err.Error())
	}

	lis, err := net.Listen("tcp", ":"+strconv.FormatInt(port, 10))
	if err != nil {
		return err
	}

	var opts []grpc.ServerOption
	grpcServer := grpc.NewServer(opts...)
	simRPC.RegisterSimHostServer(grpcServer, simHostServer)
	grpcServer.Serve(lis)
	return nil
}
