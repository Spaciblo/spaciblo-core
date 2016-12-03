.PHONY: clean clean_deps go_get_deps lint compile install_demo test psql

API_PORT := 9000
SIM_PORT := 9010
WS_PORT := 9020

DOCROOT_DIR = $(PWD)/docroot

POSTGRES_USER := trevor
POSTGRES_PASSWORD := seekret
POSTGRES_HOST := localhost
POSTGRES_PORT := 5432

POSTGRES_DB_NAME := spaciblo
POSTGRES_TEST_DB_NAME := spaciblo_test

SESSION_SECRET := "fr0styth3sn0wm@n"

STATIC_DIR := $(PWD)/go/src/spaciblo.org/be/static/
FILE_STORAGE_DIR := $(PWD)/file_storage

MAIN_PKGS := spaciblo.org/api/api spaciblo.org/sim/sim spaciblo.org/ws/ws spaciblo.org/all_in_one

COMMON_POSTGRES_ENVS := POSTGRES_USER=$(POSTGRES_USER) \
						POSTGRES_PASSWORD=$(POSTGRES_PASSWORD) \
						POSTGRES_HOST=$(POSTGRES_HOST) \
						POSTGRES_PORT=$(POSTGRES_PORT)

MAIN_POSTGRES_ENVS :=	$(COMMON_POSTGRES_ENVS) \
						POSTGRES_DB_NAME=$(POSTGRES_DB_NAME)

TEST_POSTGRES_ENVS := 	$(COMMON_POSTGRES_ENVS) \
						POSTGRES_DB_NAME=$(POSTGRES_TEST_DB_NAME) 

API_RUNTIME_ENVS := 	API_PORT=$(API_PORT) \
						STATIC_DIR=$(STATIC_DIR) \
						FILE_STORAGE_DIR=$(FILE_STORAGE_DIR) \
						DOCROOT_DIR=$(DOCROOT_DIR) \
						SESSION_SECRET=$(SESSION_SECRET) \

SIM_RUNTIME_ENVS := 	SIM_PORT=$(SIM_PORT) \

WS_RUNTIME_ENVS := 		WS_PORT=$(WS_PORT) \

SIM_DIR := go/src/spaciblo.org/sim/

all: go_get_deps compile

clean:
	rm -rf go/bin go/pkg deploy collect

clean_deps:
	rm -rf go/src/github.com go/src/golang.org go/src/gopkg.in google.golang.org

go_get_deps:
	go get github.com/chai2010/assert
	go get github.com/urfave/negroni
	go get github.com/gorilla/mux
	go get github.com/lib/pq
	go get github.com/nu7hatch/gouuid
	go get github.com/rs/cors
	go get github.com/goincremental/negroni-sessions
	go get github.com/golang/lint
	go get github.com/nfnt/resize
	go get github.com/gorilla/websocket
	go get github.com/golang/protobuf/{proto,protoc-gen-go}
	go get golang.org/x/crypto/bcrypt
	go get gopkg.in/gorp.v2
	go get google.golang.org/grpc

lint:
	go install github.com/golang/lint/...
	golint spaciblo.org/...

generate_protobuf:
	protoc -I ${SIM_DIR} ${SIM_DIR}sim.proto --go_out=plugins=grpc:${SIM_DIR}

compile: 
	go install -v $(MAIN_PKGS)

run_api: compile
	-mkdir $(FILE_STORAGE_DIR)
	$(API_RUNTIME_ENVS) $(MAIN_POSTGRES_ENVS) go/bin/api

run_sim: compile
	$(SIM_RUNTIME_ENVS) $(MAIN_POSTGRES_ENVS) go/bin/sim

run_ws: compile
	$(WS_RUNTIME_ENVS) $(MAIN_POSTGRES_ENVS) go/bin/ws

run_all: compile
	$(API_RUNTIME_ENVS) $(SIM_RUNTIME_ENVS) $(WS_RUNTIME_ENVS) $(MAIN_POSTGRES_ENVS) go/bin/all_in_one

install_demo:
	-echo "drop database $(POSTGRES_DB_NAME); create database $(POSTGRES_DB_NAME);" | psql
	go install -v spaciblo.org/be/install_demo
	$(MAIN_POSTGRES_ENVS) $(GOBIN)/install_demo

test:
	-echo "drop database $(POSTGRES_TEST_DB_NAME)" | psql
	$(TEST_POSTGRES_ENVS) go test -v spaciblo.org/api/... spaciblo.org/sim/... spaciblo.org/ws/...
	$(TEST_POSTGRES_ENVS) go test -v spaciblo.org/be/...

psql:
	scripts/db_shell.sh $(POSTGRES_USER) $(POSTGRES_PASSWORD) $(POSTGRES_DB_NAME)

