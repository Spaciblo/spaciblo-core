package ws

import (
	"errors"

	"golang.org/x/net/context"
	simRPC "spaciblo.org/sim/rpc"
)

func RouteClientMessage(clientMessage ClientMessage, clientUUID string, userUUID string, spaceUUID string, simHostClient simRPC.SimHostClient) ([]string, ClientMessage, error) {
	switch clientMessage.MessageType() {
	case PingType:
		ping := clientMessage.(*PingMessage)
		return []string{clientUUID}, NewAckMessage(ping.Message), nil
	case JoinSpaceType:
		if spaceUUID != "" {
			logger.Println("Tried to join a second space")
			return nil, nil, errors.New("Tried to join a second space")
		}
		// Right now we allow any client into any space
		// TODO implement some sort of private/public/ACL access
		joinSpace := clientMessage.(*JoinSpaceMessage)
		rpMessage := &simRPC.ClientMembership{
			ClientUUID: clientUUID,
			UserUUID:   userUUID,
			SpaceUUID:  joinSpace.UUID,
			Member:     true,
			Avatar:     joinSpace.Avatar,
		}
		_, err := simHostClient.HandleClientMembership(context.Background(), rpMessage)
		if err != nil {
			logger.Printf("Failed to join space: %v", err)
			return nil, nil, err
		}
		return []string{clientUUID}, NewAckMessage("Ok"), nil
	case ClientDisconnectedType:
		if spaceUUID == "" {
			// No need to notify a sim
			return nil, nil, nil
		}
		rpMessage := &simRPC.ClientMembership{
			ClientUUID: clientUUID,
			UserUUID:   userUUID,
			SpaceUUID:  spaceUUID,
			Member:     false,
		}
		_, err := simHostClient.HandleClientMembership(context.Background(), rpMessage)
		if err != nil {
			logger.Printf("Failed to notify sim of disconnected client: %v", err)
			return nil, nil, err
		}
		return nil, nil, nil
	case AvatarMotionType:
		avatarMotion := clientMessage.(*AvatarMotionMessage)
		var avatarMotionRPM = &simRPC.AvatarMotion{
			SpaceUUID:   avatarMotion.SpaceUUID,
			ClientUUID:  clientUUID,
			Position:    avatarMotion.Position,
			Orientation: avatarMotion.Orientation,
			Translation: avatarMotion.Translation,
			Rotation:    avatarMotion.Rotation,
			BodyUpdates: []*simRPC.BodyUpdate{},
		}
		for _, bodyUpdate := range avatarMotion.BodyUpdates {
			avatarMotionRPM.BodyUpdates = append(avatarMotionRPM.BodyUpdates, &simRPC.BodyUpdate{
				Name:        bodyUpdate.Name,
				Position:    bodyUpdate.Position,
				Orientation: bodyUpdate.Orientation,
				Translation: bodyUpdate.Translation,
				Rotation:    bodyUpdate.Rotation,
			})
		}
		_, err := simHostClient.HandleAvatarMotion(context.Background(), avatarMotionRPM)
		if err != nil {
			logger.Printf("Failed to handle avatar motion: %v", err)
			return nil, nil, err
		}
		return nil, nil, nil
	case AddNodeRequestType:
		addNodeRequest := clientMessage.(*AddNodeRequestMessage)
		requestRPM := &simRPC.AddNodeRequest{
			ClientUUID:   clientUUID,
			SpaceUUID:    addNodeRequest.SpaceUUID,
			Parent:       addNodeRequest.Parent,
			TemplateUUID: addNodeRequest.TemplateUUID,
			Position:     addNodeRequest.Position,
			Orientation:  addNodeRequest.Orientation,
			Leader:       addNodeRequest.Leader,
		}
		_, err := simHostClient.HandleAddNodeRequest(context.Background(), requestRPM)
		return nil, nil, err
	case RemoveNodeRequestType:
		removeNodeRequest := clientMessage.(*RemoveNodeRequestMessage)
		requestRPM := &simRPC.RemoveNodeRequest{
			ClientUUID: clientUUID,
			SpaceUUID:  removeNodeRequest.SpaceUUID,
			Id:         removeNodeRequest.Id,
		}
		_, err := simHostClient.HandleRemoveNodeRequest(context.Background(), requestRPM)
		return nil, nil, err
	case UpdateRequestType:
		updateRequest := clientMessage.(*UpdateRequestMessage)
		updateRPM := &simRPC.UpdateRequest{
			SpaceUUID:   updateRequest.SpaceUUID,
			ClientUUID:  clientUUID,
			NodeUpdates: []*simRPC.NodeUpdate{},
		}
		for _, nodeUpdate := range updateRequest.NodeUpdateMessages {
			settings := []*simRPC.Setting{}
			for settingName, settingValue := range nodeUpdate.Settings {
				settings = append(settings, &simRPC.Setting{
					Name:  settingName,
					Value: settingValue,
				})
			}
			updateRPM.NodeUpdates = append(updateRPM.NodeUpdates, &simRPC.NodeUpdate{
				Id:           nodeUpdate.Id,
				Settings:     settings,
				TemplateUUID: nodeUpdate.TemplateUUID,
				Position:     nodeUpdate.Position,
				Orientation:  nodeUpdate.Orientation,
				Translation:  nodeUpdate.Translation,
				Rotation:     nodeUpdate.Rotation,
				Scale:        nodeUpdate.Scale,
				Leader:       nodeUpdate.Leader,
			})
		}
		_, err := simHostClient.HandleUpdateRequest(context.Background(), updateRPM)
		return nil, nil, err
	case RelaySDPType:
		message := clientMessage.(*RelaySDPMessage)
		response := &SDPMessage{
			TypedMessage{Type: SDPType},
			clientUUID,
			message.Description,
		}
		return []string{message.DestinationClientUUID}, response, nil
	case RelayICEType:
		message := clientMessage.(*RelayICEMessage)
		response := &ICEMessage{
			TypedMessage{Type: ICEType},
			clientUUID,
			message.Candidate,
		}
		return []string{message.DestinationClientUUID}, response, nil
	default:
		logger.Printf("Unknown message type: %s", clientMessage)
		return []string{clientUUID}, NewUnknownMessageTypeMessage(clientMessage.MessageType()), nil
	}
}
