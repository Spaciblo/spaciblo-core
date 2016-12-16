# Spaciblō Core

The Spaciblō project builds hosting tools for browser based, social, 3D spaces. 

This repository holds the implementation of the Spaciblō tools. The [Spaciblō](https://github.com/Spaciblo/spaciblo) repository will hold the project-wide documents and [wiki](https://github.com/Spaciblo/spaciblo/wiki). 

We started this project a few years ago with Python and early WebGL, but it was slow going. Now we're implementing it using Go, ES6, and a mature WebGL with WebVR coming soon.

This is pre-alpha software and is currently suitable only for developers interested in working on web based VR spaces. That said, it has good bones and with work can turn into a useful piece of infrastructure for VR on the web.

# Building

In bash in the spaciblo-core dir, `source env.sh` to set up your Go environment variables.

The default `Makefile` target will use `go get` to fetch dependencies and then build the three Spaciblō service binaries: api, sim, and ws.

So, to build just run:

	make

## Database setup

Spaciblō works with PostgreSQL. Look at the top of the Makefile for the username/password/database settings that the make targets use during development.

## Development

During dev, it's handy to install demo templates and a space:

	make install_demo

The `make run_{api,sim,ws}` targets will set environment variables useful during dev and run one of the services, but most of the time it's easier to start all of the services in one process like so:

	make run_all

Point your browser at [http://127.0.0.1:9000](http://127.0.0.1:9000/) and click a cube and to enter a space. Use the arrow keys to move around.

Point a second browser at the same URL and they'll see each others' avatars.

If you use the run_all target and want to access the service through a firewall or inside a cloud security group, you'll need to open up port 9000 (HTTP) and 9020 (WebSocket to sim proxy).

If you want to run the services in their own processes, look in the Makefile to see what environment variables need to be set to determine ports, DB settings, etc.

## Generating new protobuf code

You shouldn't need to do this unless you change one of the *.proto files, but if you do that then do this to generate new go code for gRPC:

[Download the 3.1.0 protobuf compiler](https://github.com/google/protobuf/releases) for your platform and install it beside spaciblo-core such that `protoc` is in `../protoc-3.1.0/bin/` relative to the root of spaciblo-core.

The 'make generate_protobuf' target will generate the service code in api.pb.go, sim.pb.go, and ws.pb.go.

 