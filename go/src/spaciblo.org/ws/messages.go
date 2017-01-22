package ws

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

const PingType = "Ping"
const AckType = "Ack"
const UnknownMessageType = "Unknown-Message-Type"
const ConnectedType = "Connected"
const JoinSpaceType = "Join-Space"
const ClientDisconnectedType = "Client-Disconnected"
const AvatarMotionType = "Avatar-Motion"
const SpaceUpdateType = "Space-Update"

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
type PingMessage struct {
	TypedMessage
	Message string `json:"message"`
}

func NewPingMessage(message string) *PingMessage {
	return &PingMessage{
		TypedMessage{Type: PingType},
		message,
	}
}

// Ack is a ClientMessage used to test a round trip between the browser and the ws service
type AckMessage struct {
	TypedMessage
	Message string `json:"message"`
}

func NewAckMessage(message string) *AckMessage {
	return &AckMessage{
		TypedMessage{Type: AckType},
		message,
	}
}

// JoinSpace is sent by a client when it wants to receive space replication events from a sim
type JoinSpaceMessage struct {
	TypedMessage
	UUID   string `json:"uuid"`
	Avatar bool   `json:"avatar"`
}

func NewJoinSpaceMessage(uuid string, avatar bool) *JoinSpaceMessage {
	return &JoinSpaceMessage{
		TypedMessage{Type: JoinSpaceType},
		uuid,
		avatar,
	}
}

// Sent when the client first connects to the WebSocket service
type ConnectedMessage struct {
	TypedMessage
	ClientUUID string `json:"clientUUID"`
}

func NewConnectedMessage(clientUUID string) *ConnectedMessage {
	return &ConnectedMessage{
		TypedMessage{Type: ConnectedType},
		clientUUID,
	}
}

type SpaceUpdateMessage struct {
	TypedMessage
	SpaceUUID   string               `json:"spaceUUID"`
	Frame       int64                `json:"frame"`
	NodeUpdates []*NodeUpdateMessage `json:"nodeUpdates"`
	Additions   []*AdditionMessage   `json:"additions"`
	Deletions   []int64              `json:"deletions"`
}

func NewSpaceUpdateMessage(spaceUUID string, frame int64) *SpaceUpdateMessage {
	return &SpaceUpdateMessage{
		TypedMessage{Type: SpaceUpdateType},
		spaceUUID,
		frame,
		[]*NodeUpdateMessage{},
		[]*AdditionMessage{},
		[]int64{},
	}
}

type NodeUpdateMessage struct {
	Id          int64             `json:"id"`
	Settings    map[string]string `json:"settings"`
	Position    []float64         `json:"position"`
	Orientation []float64         `json:"orientation"`
	Translation []float64         `json:"translation"`
	Rotation    []float64         `json:"rotation"`
	Scale       []float64         `json:"scale"`
}

type AdditionMessage struct {
	Id           int64             `json:"id"`
	Settings     map[string]string `json:"settings"`
	Position     []float64         `json:"position"`
	Orientation  []float64         `json:"orientation"`
	Translation  []float64         `json:"translation"`
	Rotation     []float64         `json:"rotation"`
	Scale        []float64         `json:"scale"`
	Parent       int64             `json:"parent"`
	TemplateUUID string            `json:"templateUUID"`
}

type ClientDisconnectedMessage struct {
	TypedMessage
}

func NewClientDisconnectedMessage() *ClientDisconnectedMessage {
	return &ClientDisconnectedMessage{
		TypedMessage{Type: ClientDisconnectedType},
	}
}

/*
An update for a body part like a head or a hand
*/
type BodyUpdateMessage struct {
	Name        string    `json:"name"`
	Position    []float64 `json:"position"`
	Orientation []float64 `json:"orientation"`
	Translation []float64 `json:"translation"`
	Rotation    []float64 `json:"rotation"`
	Scale       []float64 `json:"scale"`
}

// AvatarMotion is sent by a client when the user moves their avatar
type AvatarMotionMessage struct {
	TypedMessage
	SpaceUUID   string              `json:"spaceUUID"`
	Position    []float64           `json:"position"`
	Orientation []float64           `json:"orientation"`
	Translation []float64           `json:"translation"`
	Rotation    []float64           `json:"rotation"`
	Scale       []float64           `json:"scale"`
	BodyUpdates []BodyUpdateMessage `json:"bodyUpdates"`
}

func NewAvatarMotionMessage(spaceUUID string, position []float64, orientation []float64, translation []float64, rotation []float64, scale []float64) *AvatarMotionMessage {
	return &AvatarMotionMessage{
		TypedMessage{Type: AvatarMotionType},
		spaceUUID,
		position,
		orientation,
		translation,
		rotation,
		scale,
		[]BodyUpdateMessage{},
	}
}

// UnknownMessageTypeMessage is sent when an incoming message's type value can not be mapped to a message struct
type UnknownMessageTypeMessage struct {
	TypedMessage
	UnknownType string `json:"unknownType"`
}

func NewUnknownMessageTypeMessage(unknownType string) *UnknownMessageTypeMessage {
	return &UnknownMessageTypeMessage{
		TypedMessage{Type: UnknownMessageType},
		unknownType,
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
	var parsedMessage ClientMessage
	switch typedMessage.Type {
	case PingType:
		parsedMessage = new(PingMessage)
	case JoinSpaceType:
		parsedMessage = new(JoinSpaceMessage)
	case AvatarMotionType:
		parsedMessage = new(AvatarMotionMessage)
	default:
		return typedMessage, nil
	}
	err = json.NewDecoder(strings.NewReader(rawMessage)).Decode(parsedMessage)
	if err != nil {
		return nil, err
	}
	return parsedMessage, nil
}
