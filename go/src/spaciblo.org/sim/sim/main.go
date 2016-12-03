/*
The binary for running the sim service.
*/
package main

import (
	"log"
	"os"

	"spaciblo.org/sim"
)

var logger = log.New(os.Stdout, "[sim-host] ", 0)

func main() {
	err := sim.StartSimHost()
	if err != nil {
		logger.Printf("Error starting sim host: %s", err)
	}
}
