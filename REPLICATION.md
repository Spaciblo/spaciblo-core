
## Adding message types

### From client to sim

- Update `messages.go` to add the new message type
- Update `RouteClientMessage` in `router.go` to parse the new message type
- Update `sim.proto` and generate protobufs
- Update `sim_host.go` and implement the message handler func
- Update `simulator.go` to create a channel for notices and handle them in Tick


