package main

import (
	"log"
	"os"

	"golang.org/x/net/context"
	"google.golang.org/grpc"
	"google.golang.org/grpc/grpclog"

	"spaciblo.org/sim"
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
	client := sim.NewSimHostClient(conn)
	logger.Printf("Started client...")

	var ping = new(sim.Ping)
	ack, err := client.SendPing(context.Background(), ping)
	if err != nil {
		grpclog.Fatalf("failed to ping: %v", err)
	}
	logger.Printf("Receved Ack: ", ack.Message)

	var params = new(sim.ListSimInfosParams)
	simInfoList, err := client.ListSimInfos(context.Background(), params)
	if err != nil {
		grpclog.Fatalf("failed to ping: %v", err)
	}
	logger.Printf("SimInfos: %s", simInfoList)
}
