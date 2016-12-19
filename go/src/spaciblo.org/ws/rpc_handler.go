package ws

import (
	"net"
	"strconv"

	context "golang.org/x/net/context"
	grpc "google.golang.org/grpc"

	wsRPC "spaciblo.org/ws/rpc"
)

type RPCHostServer struct {
	WebSocketHandler *WebSocketHandler
	RPCServer        *grpc.Server
}

func NewRPCHostServer(wsHandler *WebSocketHandler) (*RPCHostServer, error) {
	server := &RPCHostServer{
		WebSocketHandler: wsHandler,
	}
	return server, nil
}

func (server *RPCHostServer) HandlePing(ctxt context.Context, ping *wsRPC.Ping) (*wsRPC.Ack, error) {
	return &wsRPC.Ack{Message: "OK"}, nil
}

func (server *RPCHostServer) SendSpaceUpdate(ctx context.Context, spaceUpdate *wsRPC.SpaceUpdate) (*wsRPC.Ack, error) {
	spaceUpdateMessage := NewSpaceUpdateMessage(spaceUpdate.SpaceUUID, spaceUpdate.Frame)

	for _, addition := range spaceUpdate.Additions {
		wsAddition := &AdditionMessage{
			Id:           addition.Id,
			Settings:     make(map[string]string),
			Position:     addition.Position,
			Orientation:  addition.Orientation,
			Translation:  addition.Translation,
			Rotation:     addition.Rotation,
			Scale:        addition.Scale,
			Parent:       addition.Parent,
			TemplateUUID: addition.TemplateUUID,
		}
		for _, setting := range addition.Settings {
			wsAddition.Settings[setting.Key] = setting.Value
		}
		spaceUpdateMessage.Additions = append(spaceUpdateMessage.Additions, wsAddition)
	}
	spaceUpdateMessage.Deletions = spaceUpdate.Deletions

	for _, update := range spaceUpdate.NodeUpdates {
		updateMessage := &NodeUpdateMessage{
			Id:          update.Id,
			Settings:    make(map[string]string),
			Position:    update.Position,
			Orientation: update.Orientation,
			Translation: update.Translation,
			Rotation:    update.Rotation,
			Scale:       update.Scale,
		}
		for _, setting := range update.Settings {
			updateMessage.Settings[setting.Key] = setting.Value
		}
		spaceUpdateMessage.NodeUpdates = append(spaceUpdateMessage.NodeUpdates, updateMessage)
	}

	server.WebSocketHandler.Distribute(spaceUpdate.ClientUUIDs, spaceUpdateMessage)
	return &wsRPC.Ack{Message: "OK"}, nil
}

func (server *RPCHostServer) Serve(port int64) error {
	lis, err := net.Listen("tcp", ":"+strconv.FormatInt(port, 10))
	if err != nil {
		return err
	}

	var opts []grpc.ServerOption
	server.RPCServer = grpc.NewServer(opts...)
	wsRPC.RegisterWSHostServer(server.RPCServer, server)
	server.RPCServer.Serve(lis)
	return nil
}
