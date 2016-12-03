/*
The binary for running the ws (WebSocket) service.
*/
package main

import (
	"log"
	"os"

	"spaciblo.org/ws"
)

var logger = log.New(os.Stdout, "[ws] ", 0)

func main() {
	err := ws.StartWS()
	if err != nil {
		logger.Printf("Error starting ws: %s", err)
	}
}
