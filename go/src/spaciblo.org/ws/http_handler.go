package ws

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

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
	SimHostClient simRPC.SimHostClient
}

func NewWebSocketHandler(simHost string, simPort int64) (*WebSocketHandler, error) {
	var opts []grpc.DialOption
	opts = append(opts, grpc.WithInsecure())
	conn, err := grpc.Dial(fmt.Sprintf("%s:%s", simHost, strconv.FormatInt(simPort, 10)), opts...)
	if err != nil {
		logger.Printf("Failed to dial the sim host: %v", err)
		return nil, err
	}
	client := simRPC.NewSimHostClient(conn)

	// TODO make it possible to clean up the SimHostClient when we make this a StoppableListener

	return &WebSocketHandler{
		client,
	}, nil
}

func (wsh WebSocketHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Println(err)
		return
	}

	for {
		messageType, rawMessage, err := conn.ReadMessage()
		if err != nil {
			logger.Printf("Error reading WS message: %s", err)
			return
		}

		typedMessage, err := ParseMessageJson(string(rawMessage))
		if err != nil {
			logger.Println(err)
			continue
		}
		responseMessage, err := RouteClientMessage(typedMessage, wsh.SimHostClient)
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
