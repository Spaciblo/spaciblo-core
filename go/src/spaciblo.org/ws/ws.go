package ws

import (
	"log"
	"os"
	"strconv"
)

var logger = log.New(os.Stdout, "[ws] ", 0)

func StartWS() error {
	port, err := strconv.ParseInt(os.Getenv("WS_PORT"), 10, 64)
	if err != nil {
		logger.Panic("No WS_PORT env variable")
		return err
	}
	logger.Print("WS_PORT:\t\t", port)

	// TODO Actually do something with WebSockets

	return nil
}
