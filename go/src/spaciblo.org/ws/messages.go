package ws

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

const PingType = "Ping"
const AckType = "Ack"

// All messages passed via WebSocket between the browser and the ws service must be of type ClientMessage
type ClientMessage interface {
	MessageType() string
}

// TypedMessage implements the ClientMessage interface and all other messages include it
type TypedMessage struct {
	Type string `json:"type"`
}

func (message TypedMessage) MessageType() string {
	return message.Type
}

// Ping is a ClientMessage used to test a round trip between the browser and the ws service
type Ping struct {
	TypedMessage
	Message string `json:"message"`
}

func NewPing(message string) *Ping {
	return &Ping{
		TypedMessage{Type: PingType},
		message,
	}
}

// Ack is a ClientMessage used to test a round trip between the browser and the ws service
type Ack struct {
	TypedMessage
	Message string `json:"message"`
}

func NewAck(message string) *Ack {
	return &Ack{
		TypedMessage{Type: AckType},
		message,
	}
}

// ParseMessageJson takes in a raw string and returns a property typed ClientMessage based on the message.type value
func ParseMessageJson(rawMessage string) (ClientMessage, error) {
	if len(rawMessage) == 0 {
		return nil, errors.New(fmt.Sprintf("Could not parse ws message: %s", rawMessage))
	}
	typedMessage := new(TypedMessage)
	err := json.NewDecoder(strings.NewReader(rawMessage)).Decode(typedMessage)
	if err != nil {
		return nil, err
	}
	switch typedMessage.Type {
	case PingType:
		ping := new(Ping)
		err := json.NewDecoder(strings.NewReader(rawMessage)).Decode(ping)
		if err != nil {
			return nil, err
		}
		return ping, nil
	default:
		logger.Printf("Unknown message type: %s: %s", typedMessage.Type, rawMessage)
		return typedMessage, nil
	}
}
