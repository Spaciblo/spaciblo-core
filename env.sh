#!/bin/bash

# export the needed Go env variables

BASH_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# This is only used by the generate_protobuf make target which is only used if you changed a gRPC proto
PROTOC_BIN_DIR="../protoc-3.1.0/bin/"

export GOPATH="${BASH_DIR}/go"
export GOBIN="${GOPATH}/bin"
export PATH="$PATH:${GOBIN}:${PROTOC_BIN_DIR}"

