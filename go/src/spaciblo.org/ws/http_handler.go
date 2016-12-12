package ws

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/websocket"
	"google.golang.org/grpc"
	simRPC "spaciblo.org/sim/rpc"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// TODO Actually check the origin
		return true
	},
}

type WebSocketHandler struct {
	SimHost       string
	SimHostClient simRPC.SimHostClient
	Connections   map[string]*WebSocketConnection
}

func NewWebSocketHandler(simHost string) (*WebSocketHandler, error) {
	return &WebSocketHandler{
		SimHost:       simHost,
		SimHostClient: nil,
		Connections:   make(map[string]*WebSocketConnection),
	}, nil
}

func (handler *WebSocketHandler) Distribute(clientUUIDs []string, message ClientMessage) {
	// TODO use channels and go routines to make this async
	for _, clientUUID := range clientUUIDs {
		_, ok := handler.Connections[clientUUID]
		if ok == false {
			continue
		}
		if handler.Connections[clientUUID].SpaceUUID == "" && message.MessageType() == SpaceUpdateType {
			handler.Connections[clientUUID].SpaceUUID = message.(*SpaceUpdateMessage).SpaceUUID
		}
		rawMessage, _ := json.Marshal(message)
		if err := handler.Connections[clientUUID].Conn.WriteMessage(1, rawMessage); err != nil {
			logger.Println(err)
		}
	}
}

func (handler *WebSocketHandler) AddWebSocketConnection(connection *WebSocketConnection) {
	handler.Connections[connection.ClientUUID] = connection
}

func (handler *WebSocketHandler) RemoveWebSocketConnection(connection *WebSocketConnection) {
	delete(handler.Connections, connection.ClientUUID)
}

func (handler *WebSocketHandler) GetSimHostClient() (simRPC.SimHostClient, error) {
	if handler.SimHostClient == nil {
		var opts []grpc.DialOption
		opts = append(opts, grpc.WithInsecure())
		conn, err := grpc.Dial(handler.SimHost, opts...)
		if err != nil {
			logger.Printf("Failed to dial the sim host: %v", err)
			return nil, err
		}
		handler.SimHostClient = simRPC.NewSimHostClient(conn)
	}
	return handler.SimHostClient, nil
}

type WebSocketConnection struct {
	ClientUUID string
	SpaceUUID  string
	Conn       *websocket.Conn
}

func (handler WebSocketHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	simHostClient, err := handler.GetSimHostClient()
	if err != nil {
		logger.Println("Could not get a sim host client", err)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Println(err)
		return
	}
	wsConnection := &WebSocketConnection{
		ClientUUID: UUID(),
		SpaceUUID:  "",
		Conn:       conn,
	}
	handler.AddWebSocketConnection(wsConnection)

	for {
		messageType, rawMessage, err := wsConnection.Conn.ReadMessage()
		if err != nil {
			handler.RemoveWebSocketConnection(wsConnection)
			RouteClientMessage(NewClientDisconnectedMessage(), wsConnection.ClientUUID, wsConnection.SpaceUUID, simHostClient)
			return
		}
		typedMessage, err := ParseMessageJson(string(rawMessage))
		if err != nil {
			logger.Println(err)
			continue
		}
		responseMessage, err := RouteClientMessage(typedMessage, wsConnection.ClientUUID, wsConnection.SpaceUUID, simHostClient)
		if err != nil {
			logger.Printf("Error routing client message: %s", err)
		} else if responseMessage != nil {
			rawResponse, err := json.Marshal(responseMessage)
			if err = conn.WriteMessage(messageType, rawResponse); err != nil {
				logger.Println(err)
			}
		}
	}
}
