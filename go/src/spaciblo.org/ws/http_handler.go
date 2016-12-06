package ws

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/websocket"
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
}

func NewWebSocketHandler() *WebSocketHandler {
	return &WebSocketHandler{}
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
		responseMessage, err := RouteClientMessage(typedMessage)
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
