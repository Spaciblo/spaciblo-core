/*
Package all_in_one provides a binary for running the api, sim, and ws service in a single process (mostly during development)
*/
package main

import (
	"log"
	"os"
	"time"

	"spaciblo.org/api"
	"spaciblo.org/sim"
	"spaciblo.org/ws"
)

var logger = log.New(os.Stdout, "[all-in-one] ", 0)

func main() {
	go func() {
		err := sim.StartSimHost()
		if err != nil {
			logger.Fatal("Error starting sim host", err)
		}
	}()
	time.Sleep(100 * time.Millisecond) // TODO Use a less lame method for waiting for the sim host to start
	go ws.StartWS()
	time.Sleep(100 * time.Millisecond)
	api.StartAPI()
}
