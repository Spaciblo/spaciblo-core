package ws

import (
	"golang.org/x/net/context"
	simRPC "spaciblo.org/sim/rpc"
)

func RouteClientMessage(clientMessage ClientMessage, clientUUID string, simHostClient simRPC.SimHostClient) (ClientMessage, error) {
	switch clientMessage.MessageType() {
	case PingType:
		ping := clientMessage.(*PingMessage)
		return NewAckMessage(ping.Message), nil
	case JoinSpaceType:
		joinSpace := clientMessage.(*JoinSpaceMessage)
		var joinSpaceRPM = new(simRPC.JoinSpace)
		joinSpaceRPM.SpaceUUID = joinSpace.UUID
		joinSpaceRPM.ClientUUID = clientUUID
		joinedSpace, err := simHostClient.RequestJoinSpace(context.Background(), joinSpaceRPM)
		if err != nil {
			logger.Printf("Failed to join space: %v", err)
			return nil, err
		}
		return NewJoinedSpaceMessage(joinedSpace.Uuid, joinedSpace.State), nil
	case AvatarMotionType:
		avatarMotion := clientMessage.(*AvatarMotionMessage)
		var avatarMotionRPM = &simRPC.AvatarMotion{
			SpaceUUID:   avatarMotion.SpaceUUID,
			ClientUUID:  clientUUID,
			Position:    avatarMotion.Position,
			Orientation: avatarMotion.Orientation,
			Translation: avatarMotion.Translation,
			Rotation:    avatarMotion.Rotation,
		}
		_, err := simHostClient.HandleAvatarMotion(context.Background(), avatarMotionRPM)
		if err != nil {
			logger.Printf("Failed to handle avatar motion: %v", err)
			return nil, err
		}
		return nil, nil
	case ClientDisconnectedType:
		clientDisconnectedRPM := &simRPC.ClientDisconnected{
			ClientUUID: clientUUID,
		}
		_, err := simHostClient.HandleClientDisconnected(context.Background(), clientDisconnectedRPM)
		if err != nil {
			logger.Printf("Failed to handle client disconnection: %v", err)
			return nil, err
		}
		return nil, nil
	default:
		logger.Printf("Unknown message type: %s", clientMessage)
		return NewUnknownMessageTypeMessage(clientMessage.MessageType()), nil
	}
}
