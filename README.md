# Spaciblō Core

The Spaciblō project builds hosting tools for browser based, social, 3D spaces. 

This repository holds the implementation of the Spaciblō tools. The [Spaciblō](https://github.com/Spaciblo/spaciblo) repository will hold the project-wide documents and [wiki](https://github.com/Spaciblo/spaciblo/wiki). 

We started this project a few years ago with Python and early WebGL, but it was slow going. Now we're implementing it using Go, ES6, and a mature WebGL with WebVR coming soon.

# Building

In bash in the spaciblo-core dir, `source env.sh` to set up your Go environment variables.

The default `Makefile` target will use `go get` to fetch dependencies and then build the three Spaciblō service binaries: api, sim, and ws.

The `make run_{api,sim,ws}` targets will set environment variables useful during dev and run one of the services.

This repository holds the Go based implementation of the Spaciblō tools. The [Spaciblō](https://github.com/Spaciblo/spaciblo) repository will hold the project-wide documents and [wiki](https://github.com/Spaciblo/spaciblo/wiki). 

## Generating new protobuf code

[Download the 3.1.0 protobuf compiler](https://github.com/google/protobuf/releases) for your platform and install it beside spaciblo-core such that `protoc` is in `../protoc-3.1.0/bin/` relative to the root of spaciblo-core.

The 'make generate_protobuf' target will generate the service code in api.pb.go, sim.pb.go, and ws.pb.go.

 