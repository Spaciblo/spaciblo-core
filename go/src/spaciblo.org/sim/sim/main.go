/*
The binary for running the sim service.
*/
package main

import (
	"log"
	"os"
	"time"

	"spaciblo.org/sim"
)

var logger = log.New(os.Stdout, "[sim-host] ", 0)

func main() {
	err := sim.StartSimHostFromEnvVariables()
	if err != nil {
		logger.Println("Error starting sim", err)
		return
	}
	for {
		time.Sleep(time.Hour)
	}
}
