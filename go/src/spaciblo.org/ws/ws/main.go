/*
The binary for running the ws (WebSocket) service.
*/
package main

import (
	"log"
	"os"
	"time"

	"spaciblo.org/ws"
)

var logger = log.New(os.Stdout, "[ws] ", 0)

func main() {
	err := ws.StartWSFromEnvVariables()
	if err != nil {
		logger.Printf("Error starting ws: %s", err)
	}
	for {
		time.Sleep(time.Hour)
	}
}
