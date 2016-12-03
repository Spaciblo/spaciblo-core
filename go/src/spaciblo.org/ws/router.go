package ws

import (
	"errors"
	"fmt"
)

func RouteClientMessage(clientMessage ClientMessage) (ClientMessage, error) {
	switch clientMessage.MessageType() {
	case PingType:
		//ping := clientMessage.(*Ping)
		return NewAck("Got cha!"), nil
	default:
		logger.Printf("Unknown Message: %s", clientMessage)
		return nil, errors.New(fmt.Sprintf("Unknown message: %s", clientMessage))
	}
}
