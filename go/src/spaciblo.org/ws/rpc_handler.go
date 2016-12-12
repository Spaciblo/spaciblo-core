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

func (server *hostServer) SendSpaceUpdate(ctx context.Context, spaceUpdate *wsRPC.SpaceUpdate) (*wsRPC.Ack, error) {
	spaceUpdateMessage := NewSpaceUpdateMessage(spaceUpdate.SpaceUUID)

	for _, addition := range spaceUpdate.Additions {
		spaceUpdateMessage.Additions = append(spaceUpdateMessage.Additions, &AdditionMessage{
			Id:           addition.Id,
			Position:     addition.Position,
			Orientation:  addition.Orientation,
			Translation:  addition.Translation,
			Rotation:     addition.Rotation,
			Scale:        addition.Scale,
			Parent:       addition.Parent,
			TemplateUUID: addition.TemplateUUID,
		})
	}
	spaceUpdateMessage.Deletions = spaceUpdate.Deletions

	for _, update := range spaceUpdate.NodeUpdates {
		updateMessage := &NodeUpdateMessage{
			Id:          update.Id,
			Position:    update.Position,
			Orientation: update.Orientation,
			Translation: update.Translation,
			Rotation:    update.Rotation,
			Scale:       update.Scale,
		}
		spaceUpdateMessage.NodeUpdates = append(spaceUpdateMessage.NodeUpdates, updateMessage)
	}

	server.WebSocketHandler.Distribute(spaceUpdate.ClientUUIDs, spaceUpdateMessage)
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
