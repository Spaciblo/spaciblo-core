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

func NewSimHostServer(wsHost string, dbInfo *be.DBInfo) (*SimHostServer, error) {
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
		spaceSim, err := NewSpaceSimulator(spaceRecord.UUID, server, dbInfo)
		if err != nil {
			logger.Println("Error creating space simulator: ", spaceRecord.Name+": ", err)
			return nil, err
		}
		server.SpaceSimulators[spaceRecord.UUID] = spaceSim
		spaceSim.StartTime()
	}

	return server, nil
}

func (server *SimHostServer) SendClientUpdate(spaceUUID string, frame int64, clientUUIDs []string, additions []*SceneAddition, deletions []int64, updates []*NodeUpdate) error {
	if len(clientUUIDs) == 0 {
		// No point in sending updates with no recipients
		return nil
	}
	wsClient, err := server.GetWSHostClient()
	if err != nil {
		return err
	}
	spaceUpdate := &wsRPC.SpaceUpdate{
		SpaceUUID:   spaceUUID,
		Frame:       frame,
		ClientUUIDs: clientUUIDs,
		NodeUpdates: []*wsRPC.NodeUpdate{},
		Additions:   []*wsRPC.Addition{},
		Deletions:   deletions,
	}
	for _, addition := range additions {
		wsAddition := &wsRPC.Addition{
			Id:           addition.Node.Id,
			Settings:     []*wsRPC.Setting{},
			Position:     addition.Node.Position.Data,
			Orientation:  addition.Node.Orientation.Data,
			Translation:  addition.Node.Translation.Data,
			Rotation:     addition.Node.Rotation.Data,
			Scale:        addition.Node.Scale.Data,
			Parent:       addition.ParentId,
			TemplateUUID: addition.Node.TemplateUUID,
		}
		for _, setting := range addition.Node.Settings {
			wsAddition.Settings = append(wsAddition.Settings, &wsRPC.Setting{
				setting.Key,
				setting.Value,
			})
		}
		spaceUpdate.Additions = append(spaceUpdate.Additions, wsAddition)
	}

	for _, update := range updates {
		wsUpdate := &wsRPC.NodeUpdate{
			Id:          update.Id,
			Settings:    []*wsRPC.Setting{},
			Position:    update.Position,
			Orientation: update.Orientation,
			Translation: update.Translation,
			Rotation:    update.Rotation,
			Scale:       update.Scale,
		}
		for _, setting := range update.Settings {
			wsUpdate.Settings = append(wsUpdate.Settings, &wsRPC.Setting{
				setting.Key,
				setting.Value,
			})
		}
		spaceUpdate.NodeUpdates = append(spaceUpdate.NodeUpdates, wsUpdate)
	}

	_, err = wsClient.SendSpaceUpdate(context.Background(), spaceUpdate)
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
	bodyUpdates := []*BodyUpdate{}
	for _, bodyUpdate := range avatarMotion.BodyUpdates {
		bodyUpdates = append(bodyUpdates, &BodyUpdate{
			Name:        bodyUpdate.Name,
			Position:    NewVector3(bodyUpdate.Position),
			Orientation: NewQuaternion(bodyUpdate.Orientation),
			Translation: NewVector3(bodyUpdate.Translation),
			Rotation:    NewVector3(bodyUpdate.Rotation),
		})
	}
	spaceSim.HandleAvatarMotion(avatarMotion.ClientUUID, avatarMotion.Position, avatarMotion.Orientation, avatarMotion.Translation, avatarMotion.Rotation, avatarMotion.Scale, bodyUpdates)
	return &simRPC.Ack{Message: "OK"}, nil
}

func (server *SimHostServer) HandleUpdateRequest(ctx context.Context, updateRequest *simRPC.UpdateRequest) (*simRPC.Ack, error) {
	spaceSim, ok := server.SpaceSimulators[updateRequest.SpaceUUID]
	if ok == false {
		return nil, errors.New("Unknown space UUID: " + updateRequest.SpaceUUID)
	}
	for _, nodeUpdate := range updateRequest.NodeUpdates {
		settings := make(map[string]string)
		for _, setting := range nodeUpdate.Settings {
			settings[setting.Name] = setting.Value
		}
		spaceSim.HandleNodeUpdate(
			nodeUpdate.Id,
			settings,
			nodeUpdate.Position,
			nodeUpdate.Orientation,
			nodeUpdate.Translation,
			nodeUpdate.Rotation,
			nodeUpdate.Scale,
		)
	}
	return &simRPC.Ack{Message: "OK"}, nil
}

func (server *SimHostServer) HandleClientMembership(ctx context.Context, clientMembership *simRPC.ClientMembership) (*simRPC.Ack, error) {
	spaceSim, ok := server.SpaceSimulators[clientMembership.SpaceUUID]
	if ok == false {
		return nil, errors.New("Unknown space UUID: " + clientMembership.SpaceUUID)
	}
	spaceSim.ChangeClientMembership(clientMembership.ClientUUID, clientMembership.Member, clientMembership.Avatar)
	return &simRPC.Ack{Message: "OK"}, nil
}

func (server *SimHostServer) ListSimInfos(context.Context, *simRPC.ListSimInfosParams) (*simRPC.SimInfoList, error) {
	return &simRPC.SimInfoList{
		Infos: []*simRPC.SimInfo{&simRPC.SimInfo{"Sim 1", "UUID1"}, &simRPC.SimInfo{"Sim 2", "UUID2"}},
	}, nil
}
