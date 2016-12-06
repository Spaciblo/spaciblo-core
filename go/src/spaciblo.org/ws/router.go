package ws

func RouteClientMessage(clientMessage ClientMessage) (ClientMessage, error) {
	switch clientMessage.MessageType() {
	case PingType:
		ping := clientMessage.(*PingMessage)
		return NewAckMessage(ping.Message), nil
	default:
		logger.Printf("Unknown message type: %s", clientMessage)
		return NewUnknownMessageTypeMessage(clientMessage.MessageType()), nil
	}
}
