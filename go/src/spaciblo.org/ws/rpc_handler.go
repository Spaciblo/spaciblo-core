package ws

import (
	"net"
	"strconv"

	context "golang.org/x/net/context"
	grpc "google.golang.org/grpc"

	wsRPC "spaciblo.org/ws/rpc"
)

type hostServer struct {
	WebSocketHandler *WebSocketHandler
}

func newHostServer(wsHandler *WebSocketHandler) (*hostServer, error) {
	server := &hostServer{
		WebSocketHandler: wsHandler,
	}
	return server, nil
}

func (server *hostServer) HandlePing(ctxt context.Context, ping *wsRPC.Ping) (*wsRPC.Ack, error) {
	return &wsRPC.Ack{Message: "OK"}, nil
}

func (server *hostServer) SendSpaceInitialization(ctx context.Context, spaceInitialization *wsRPC.SpaceInitialization) (*wsRPC.Ack, error) {
	logger.Println("Space init at WS", spaceInitialization)
	joinedSpaceMessage := NewJoinedSpaceMessage(spaceInitialization.SpaceUUID, spaceInitialization.State)
	server.WebSocketHandler.Distribute(spaceInitialization.ClientUUIDs, joinedSpaceMessage)
	return &wsRPC.Ack{Message: "OK"}, nil
}

func (server *hostServer) SendSimUpdate(ctx context.Context, simUpdate *wsRPC.SimUpdate) (*wsRPC.Ack, error) {
	logger.Println("Sim Update at WS", simUpdate)
	return &wsRPC.Ack{Message: "OK"}, nil
}

func (server *hostServer) Serve(port int64) error {
	lis, err := net.Listen("tcp", ":"+strconv.FormatInt(port, 10))
	if err != nil {
		return err
	}

	var opts []grpc.ServerOption
	grpcServer := grpc.NewServer(opts...)
	wsRPC.RegisterWSHostServer(grpcServer, server)
	grpcServer.Serve(lis)
	return nil
}
