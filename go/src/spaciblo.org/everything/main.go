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
