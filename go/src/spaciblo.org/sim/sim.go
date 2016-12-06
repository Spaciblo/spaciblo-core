/*
Package sim provides the 3D space simulations' host service.

Communication with the sim service from the ws and api services is via gRPC.
*/
package sim

import (
	"log"
	"net"
	"os"
	"strconv"

	context "golang.org/x/net/context"
	grpc "google.golang.org/grpc"
	simRPC "spaciblo.org/sim/rpc"
)

var logger = log.New(os.Stdout, "[sim-host] ", 0)

type simHostServer struct {
}

func (server *simHostServer) SendPing(ctxt context.Context, ping *simRPC.Ping) (*simRPC.Ack, error) {
	return &simRPC.Ack{Message: "ACK!"}, nil
}

func (server *simHostServer) RequestJoinSpace(ctxt context.Context, joinSpace *simRPC.JoinSpace) (*simRPC.JoinedSpace, error) {
	// TODO Actually host a space and send replication events
	logger.Printf("Join space: %s", joinSpace)
	return &simRPC.JoinedSpace{Uuid: joinSpace.Uuid}, nil
}

func (server *simHostServer) ListSimInfos(context.Context, *simRPC.ListSimInfosParams) (*simRPC.SimInfoList, error) {
	return &simRPC.SimInfoList{
		Infos: []*simRPC.SimInfo{&simRPC.SimInfo{"Sim 1", "UUID1"}, &simRPC.SimInfo{"Sim 2", "UUID2"}},
	}, nil
}

func newServer() *simHostServer {
	s := new(simHostServer)
	return s
}

func StartSimHost() error {
	port, err := strconv.ParseInt(os.Getenv("SIM_PORT"), 10, 64)
	if err != nil {
		logger.Panic("No SIM_PORT env variable")
		return err
	}
	logger.Print("SIM_PORT:\t\t", port)
	lis, err := net.Listen("tcp", ":"+strconv.FormatInt(port, 10))
	if err != nil {
		return err
	}
	var opts []grpc.ServerOption
	grpcServer := grpc.NewServer(opts...)
	simRPC.RegisterSimHostServer(grpcServer, newServer())
	grpcServer.Serve(lis)
	return nil
}
