package ws

import (
	"errors"

	"golang.org/x/net/context"
	simRPC "spaciblo.org/sim/rpc"
)

func RouteClientMessage(clientMessage ClientMessage, clientUUID string, spaceUUID string, simHostClient simRPC.SimHostClient) (ClientMessage, error) {
	switch clientMessage.MessageType() {
	case PingType:
		ping := clientMessage.(*PingMessage)
		return NewAckMessage(ping.Message), nil
	case JoinSpaceType:
		if spaceUUID != "" {
			logger.Println("Tried to join a second space")
			return nil, errors.New("Tried to join a second space")
		}
		// Right now we allow any client into any space
		// TODO implement some sort of private/public/ACL access
		joinSpace := clientMessage.(*JoinSpaceMessage)
		rpMessage := &simRPC.ClientMembership{
			ClientUUID: clientUUID,
			SpaceUUID:  joinSpace.UUID,
			Member:     true,
		}
		_, err := simHostClient.HandleClientMembership(context.Background(), rpMessage)
		if err != nil {
			logger.Printf("Failed to join space: %v", err)
			return nil, err
		}
		return NewAckMessage("Ok"), nil
	case ClientDisconnectedType:
		if spaceUUID == "" {
			// No need to notify a sim
			return nil, nil
		}
		rpMessage := &simRPC.ClientMembership{
			ClientUUID: clientUUID,
			SpaceUUID:  spaceUUID,
			Member:     false,
		}
		_, err := simHostClient.HandleClientMembership(context.Background(), rpMessage)
		if err != nil {
			logger.Printf("Failed to notify sim of disconnected client: %v", err)
			return nil, err
		}
		return nil, nil
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
	default:
		logger.Printf("Unknown message type: %s", clientMessage)
		return NewUnknownMessageTypeMessage(clientMessage.MessageType()), nil
	}
}
