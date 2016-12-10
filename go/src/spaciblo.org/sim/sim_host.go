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

	context "golang.org/x/net/context"
	grpc "google.golang.org/grpc"

	apiDB "spaciblo.org/api/db"
	"spaciblo.org/be"
	"spaciblo.org/db"
	simRPC "spaciblo.org/sim/rpc"
)

var logger = log.New(os.Stdout, "[sim-host] ", 0)

type simHostServer struct {
	SpaceSimulators map[string]*SpaceSimulator // <UUID, sim>
	DBInfo          *be.DBInfo
}

func (server *simHostServer) SendPing(ctxt context.Context, ping *simRPC.Ping) (*simRPC.Ack, error) {
	return &simRPC.Ack{Message: "ACK!"}, nil
}

func (server *simHostServer) HandleAvatarMotion(ctx context.Context, avatarMotion *simRPC.AvatarMotion) (*simRPC.Ack, error) {
	spaceSim, ok := server.SpaceSimulators[avatarMotion.SpaceUUID]
	if ok == false {
		return nil, errors.New("Unknown space UUID: " + avatarMotion.SpaceUUID)
	}
	avatarNode, ok := spaceSim.Avatars[avatarMotion.ClientUUID]
	if ok == false {
		_, err := spaceSim.AddAvatar(avatarMotion.ClientUUID, avatarMotion.Position, avatarMotion.Orientation)
		if err != nil {
			return nil, err
		}
	} else {
		avatarNode.Position.Set(avatarMotion.Position)
		avatarNode.Orientation.Set(avatarMotion.Orientation)
		// TODO handle motion
	}

	return &simRPC.Ack{Message: "ACK!"}, nil
}

func (server *simHostServer) RequestJoinSpace(ctxt context.Context, joinSpace *simRPC.JoinSpace) (*simRPC.JoinedSpace, error) {
	spaceSim, ok := server.SpaceSimulators[joinSpace.SpaceUUID]
	if ok == false {
		return nil, errors.New("Join space denied")
	}
	return &simRPC.JoinedSpace{
		Uuid:  joinSpace.SpaceUUID,
		State: spaceSim.InitialState(),
	}, nil
}

func (server *simHostServer) HandleClientDisconnected(ctx context.Context, clientDisconnected *simRPC.ClientDisconnected) (*simRPC.Ack, error) {
	for _, spaceSim := range server.SpaceSimulators {
		spaceSim.RemoveAvatar(clientDisconnected.ClientUUID)
	}
	return &simRPC.Ack{Message: "OK"}, nil
}

func (server *simHostServer) ListSimInfos(context.Context, *simRPC.ListSimInfosParams) (*simRPC.SimInfoList, error) {
	return &simRPC.SimInfoList{
		Infos: []*simRPC.SimInfo{&simRPC.SimInfo{"Sim 1", "UUID1"}, &simRPC.SimInfo{"Sim 2", "UUID2"}},
	}, nil
}

func newServer(dbInfo *be.DBInfo) (*simHostServer, error) {
	server := &simHostServer{
		make(map[string]*SpaceSimulator),
		dbInfo,
	}
	records, err := apiDB.FindAllSpaceRecords(dbInfo)
	if err != nil {
		return nil, err
	}
	for _, spaceRecord := range records {
		logger.Println("Initializing space", spaceRecord.Name+":", spaceRecord.UUID)
		state, err := spaceRecord.DecodeState()
		if err != nil {
			return nil, err
		}
		spaceSim, err := NewSpaceSimulator(spaceRecord.Name, spaceRecord.UUID, state, dbInfo)
		if err != nil {
			logger.Println("Error creating space simulator: ", spaceRecord.Name+": ", err)
			return nil, err
		}
		server.SpaceSimulators[spaceRecord.UUID] = spaceSim
	}
	return server, nil
}

func StartSimHost() error {
	port, err := strconv.ParseInt(os.Getenv("SIM_PORT"), 10, 64)
	if err != nil {
		logger.Panic("No SIM_PORT env variable")
		return err
	}
	logger.Print("SIM_PORT:\t\t", port)

	dbInfo, err := db.InitDB()
	if err != nil {
		return errors.New("DB Initialization Error: " + err.Error())
	}
	defer func() {
		dbInfo.Connection.Close()
	}()

	simHostServer, err := newServer(dbInfo)
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
