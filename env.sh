#!/bin/bash

# cd into the GOPATH and export the needed Go env variables

BASH_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd ${BASH_DIR}

export GOPATH="${BASH_DIR}/go"
export GOBIN="${GOPATH}/bin"
export PATH="$PATH:${GOBIN}"
