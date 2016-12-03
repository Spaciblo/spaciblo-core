/*
The binary for running the api service.
*/
package main

import (
	"log"
	"os"
	"spaciblo.org/api"
)

var logger = log.New(os.Stdout, "[api] ", 0)

func main() {
	err := api.StartAPI()
	if err != nil {
		logger.Printf("Error starting: ", err)
	}
}
