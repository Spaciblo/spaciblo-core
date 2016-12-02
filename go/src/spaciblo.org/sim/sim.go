package sim

import (
	"log"
	"net"
	"os"
	"strconv"

	context "golang.org/x/net/context"
	grpc "google.golang.org/grpc"
)

var logger = log.New(os.Stdout, "[sim-host] ", 0)

type simHostServer struct {
}

func (server *simHostServer) SendPing(context.Context, *Ping) (*Ack, error) {
	return &Ack{Message: "ACK!"}, nil
}

func (server *simHostServer) ListSimInfos(context.Context, *ListSimInfosParams) (*SimInfoList, error) {
	return &SimInfoList{
		Infos: []*SimInfo{&SimInfo{"Sim 1", "UUID1"}, &SimInfo{"Sim 2", "UUID2"}},
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
	RegisterSimHostServer(grpcServer, newServer())
	grpcServer.Serve(lis)
	return nil
}
