package sim

import (
	context "golang.org/x/net/context"
	"google.golang.org/grpc"

	simRPC "spaciblo.org/sim/rpc"
)

/*
SimRPCClient is used to communicate directly via gRPC with the sim host (e.g. from tests)
*/
type SimRPCClient struct {
	RPCHost    string
	HostClient simRPC.SimHostClient
	ClientConn *grpc.ClientConn
}

func NewSimRPCClient(rpcHost string) *SimRPCClient {
	return &SimRPCClient{
		RPCHost: rpcHost,
	}
}

func (client *SimRPCClient) Connect() error {
	var opts []grpc.DialOption
	opts = append(opts, grpc.WithInsecure())
	conn, err := grpc.Dial(client.RPCHost, opts...)
	if err != nil {
		logger.Println("Error dialing SimHostClient", err)
		return err
	}
	client.ClientConn = conn
	client.HostClient = simRPC.NewSimHostClient(client.ClientConn)
	return nil
}

func (client *SimRPCClient) Close() {
	client.ClientConn.Close()
}

func (client *SimRPCClient) Ping() (*simRPC.Ack, error) {
	ping := new(simRPC.Ping)
	return client.HostClient.HandlePing(context.Background(), ping)
}

func (client *SimRPCClient) StartSimulator(spaceUUID string) (*simRPC.Ack, error) {
	request := &simRPC.StartSimulatorRequest{
		SpaceUUID: spaceUUID,
	}
	return client.HostClient.HandleStartSimulatorRequest(context.Background(), request)
}
