/*
A binary for communicating with the sim service from the command line.

This is probably going away to be replaced by gRPC commands from the api service triggered by user actions from a web browser.
*/
package main

import (
	"log"
	"os"

	"golang.org/x/net/context"
	"google.golang.org/grpc"
	"google.golang.org/grpc/grpclog"

	simRPC "spaciblo.org/sim/rpc"
)

var logger = log.New(os.Stdout, "[sim-client] ", 0)

func main() {
	var opts []grpc.DialOption
	opts = append(opts, grpc.WithInsecure())
	conn, err := grpc.Dial("127.0.0.1:1234", opts...)
	if err != nil {
		grpclog.Fatalf("failed to dial: %v", err)
	}
	defer conn.Close()
	client := simRPC.NewSimHostClient(conn)
	logger.Printf("Started client...")

	var ping = new(simRPC.Ping)
	ack, err := client.SendPing(context.Background(), ping)
	if err != nil {
		grpclog.Fatalf("failed to ping: %v", err)
	}
	logger.Printf("Receved Ack: ", ack.Message)

	var params = new(simRPC.ListSimInfosParams)
	simInfoList, err := client.ListSimInfos(context.Background(), params)
	if err != nil {
		grpclog.Fatalf("failed to ping: %v", err)
	}
	logger.Printf("SimInfos: %s", simInfoList)
}
