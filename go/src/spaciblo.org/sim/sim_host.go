package sim

import (
	"errors"

	context "golang.org/x/net/context"
	grpc "google.golang.org/grpc"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
	simRPC "spaciblo.org/sim/rpc"
	wsRPC "spaciblo.org/ws/rpc"
)

type SimHostServer struct {
	SpaceSimulators map[string]*SpaceSimulator // <space UUID, sim>
	WSHost          string                     // hostname:port
	WSHostClient    wsRPC.WSHostClient         // an RPC client to the ws service
	DBInfo          *be.DBInfo
}

func NewSimHostServer(wsHost string, dbInfo *be.DBInfo, run bool) (*SimHostServer, error) {
	server := &SimHostServer{
		SpaceSimulators: make(map[string]*SpaceSimulator),
		WSHost:          wsHost,
		WSHostClient:    nil,
		DBInfo:          dbInfo,
	}

	// Right now an instance of sim host runs every space with a space record
	// TODO Start and stop spaces across multiple sim hosts
	records, err := apiDB.FindAllSpaceRecords(dbInfo)
	if err != nil {
		return nil, err
	}
	for _, spaceRecord := range records {
		state, err := spaceRecord.DecodeState()
		if err != nil {
			return nil, err
		}
		spaceSim, err := NewSpaceSimulator(spaceRecord.Name, spaceRecord.UUID, state, server, dbInfo)
		if err != nil {
			logger.Println("Error creating space simulator: ", spaceRecord.Name+": ", err)
			return nil, err
		}
		server.SpaceSimulators[spaceRecord.UUID] = spaceSim
		if run {
			spaceSim.StartTime()
		}
	}

	return server, nil
}

func (server *SimHostServer) SendSpaceInitialization(spaceUUID string, clientUUIDs []string, state string) error {
	if len(clientUUIDs) == 0 {
		// No point in sending updates with no recipients
		return nil
	}
	wsClient, err := server.GetWSHostClient()
	if err != nil {
		return err
	}
	spaceInitialization := &wsRPC.SpaceInitialization{
		SpaceUUID:   spaceUUID,
		ClientUUIDs: clientUUIDs,
		State:       state,
	}
	_, err = wsClient.SendSpaceInitialization(context.Background(), spaceInitialization)
	if err != nil {
		logger.Printf("Failed to send space initialization to ws: %v", err)
		return err
	}
	return nil
}

func (server *SimHostServer) SendClientUpdate(spaceUUID string, clientUUIDs []string) error {
	if len(clientUUIDs) == 0 {
		// No point in sending updates with no recipients
		return nil
	}
	wsClient, err := server.GetWSHostClient()
	if err != nil {
		return err
	}
	simUpdate := &wsRPC.SimUpdate{
		SpaceUUID:   spaceUUID,
		ClientUUIDs: clientUUIDs,
	}
	_, err = wsClient.SendSimUpdate(context.Background(), simUpdate)
	if err != nil {
		logger.Printf("Failed to send client update to ws: %v", err)
		return err
	}
	return nil
}

func (server *SimHostServer) GetWSHostClient() (wsRPC.WSHostClient, error) {
	if server.WSHostClient == nil {
		var opts []grpc.DialOption
		opts = append(opts, grpc.WithInsecure())
		conn, err := grpc.Dial(server.WSHost, opts...)
		if err != nil {
			logger.Printf("Failed to dial the ws host: %v", err)
			return nil, err
		}
		server.WSHostClient = wsRPC.NewWSHostClient(conn)
	}
	return server.WSHostClient, nil
}

func (server *SimHostServer) HandlePing(ctxt context.Context, ping *simRPC.Ping) (*simRPC.Ack, error) {
	return &simRPC.Ack{Message: "OK"}, nil
}

func (server *SimHostServer) HandleAvatarMotion(ctx context.Context, avatarMotion *simRPC.AvatarMotion) (*simRPC.Ack, error) {
	spaceSim, ok := server.SpaceSimulators[avatarMotion.SpaceUUID]
	if ok == false {
		return nil, errors.New("Unknown space UUID: " + avatarMotion.SpaceUUID)
	}
	spaceSim.HandleAvatarMotion(avatarMotion.ClientUUID, avatarMotion.Position, avatarMotion.Orientation, avatarMotion.Translation, avatarMotion.Rotation)
	return &simRPC.Ack{Message: "OK"}, nil
}

func (server *SimHostServer) HandleClientMembership(ctx context.Context, clientMembership *simRPC.ClientMembership) (*simRPC.Ack, error) {
	spaceSim, ok := server.SpaceSimulators[clientMembership.SpaceUUID]
	if ok == false {
		return nil, errors.New("Unknown space UUID: " + clientMembership.SpaceUUID)
	}
	spaceSim.ChangeClientMembership(clientMembership.ClientUUID, clientMembership.Member)
	return &simRPC.Ack{Message: "OK"}, nil
}

func (server *SimHostServer) ListSimInfos(context.Context, *simRPC.ListSimInfosParams) (*simRPC.SimInfoList, error) {
	return &simRPC.SimInfoList{
		Infos: []*simRPC.SimInfo{&simRPC.SimInfo{"Sim 1", "UUID1"}, &simRPC.SimInfo{"Sim 2", "UUID2"}},
	}, nil
}
