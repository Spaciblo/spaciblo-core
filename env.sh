#!/bin/bash

# export the needed Go env variables

PROTOC_BIN_DIR="../protoc-3.1.0/bin/"

BASH_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd ${BASH_DIR}

export GOPATH="${BASH_DIR}/go"
export GOBIN="${GOPATH}/bin"
export PATH="$PATH:${GOBIN}:${PROTOC_BIN_DIR}"
