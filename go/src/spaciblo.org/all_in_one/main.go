/*
Package all_in_one provides a binary for running the api, sim, and ws service in a single process (mostly during development)
*/
package main

import (
	"log"
	"os"

	"spaciblo.org/api"
	"spaciblo.org/sim"
	"spaciblo.org/ws"
)

var logger = log.New(os.Stdout, "[all-in-one] ", 0)

func main() {
	err := sim.StartSimHostFromEnvVariables()
	if err != nil {
		logger.Println("Error starting sim host", err)
	}
	err = ws.StartWSFromEnvVariables()
	if err != nil {
		logger.Println("Error starting WS", err)
	}
	err = api.StartAPI()
	if err != nil {
		logger.Println("Error starting API", err)
	}
}
