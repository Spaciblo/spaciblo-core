package ws

import (
	"golang.org/x/net/context"
	simRPC "spaciblo.org/sim/rpc"
)

func RouteClientMessage(clientMessage ClientMessage, simHostClient simRPC.SimHostClient) (ClientMessage, error) {
	switch clientMessage.MessageType() {
	case PingType:
		ping := clientMessage.(*PingMessage)
		return NewAckMessage(ping.Message), nil
	case JoinSpaceType:
		joinSpace := clientMessage.(*JoinSpaceMessage)

		var joinSpaceRPM = new(simRPC.JoinSpace)
		joinSpaceRPM.Uuid = joinSpace.UUID
		joinedSpace, err := simHostClient.RequestJoinSpace(context.Background(), joinSpaceRPM)
		if err != nil {
			logger.Printf("Failed to join space: %v", err)
			return nil, err
		}
		return NewJoinedSpaceMessage(joinedSpace.Uuid), nil
	default:
		logger.Printf("Unknown message type: %s", clientMessage)
		return NewUnknownMessageTypeMessage(clientMessage.MessageType()), nil
	}
}
