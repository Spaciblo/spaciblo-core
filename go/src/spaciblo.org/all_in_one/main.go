/*
Package all_in_one provides a binary for running the api, sim, and ws service in a single process (mostly during development)
*/
package main

import (
	"spaciblo.org/api"
	"spaciblo.org/sim"
	"spaciblo.org/ws"
)

func main() {
	go sim.StartSimHost()
	go ws.StartWS()
	api.StartAPI()
}
