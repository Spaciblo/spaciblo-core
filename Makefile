.PHONY: clean clean_deps go_get_deps lint compile install_demo test psql

API_PORT		:= 9000
SIM_PORT 		:= 9010
WS_PORT 		:= 9020
WS_RPC_PORT 	:= 9030

TLS_CERT := "test_certs/mycert1.cer"
TLS_KEY  := "test_certs/mycert1.key"

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

MAIN_PKGS := spaciblo.org/api/api spaciblo.org/sim/sim spaciblo.org/ws/ws spaciblo.org/all_in_one spaciblo.org/be/install_demo

COMMON_POSTGRES_ENVS := POSTGRES_USER=$(POSTGRES_USER) \
						POSTGRES_PASSWORD=$(POSTGRES_PASSWORD) \
						POSTGRES_HOST=$(POSTGRES_HOST) \
						POSTGRES_PORT=$(POSTGRES_PORT)

MAIN_POSTGRES_ENVS :=	$(COMMON_POSTGRES_ENVS) \
						POSTGRES_DB_NAME=$(POSTGRES_DB_NAME)

TEST_POSTGRES_ENVS := 	$(COMMON_POSTGRES_ENVS) \
						POSTGRES_DB_NAME=$(POSTGRES_TEST_DB_NAME) 

DEMO_RUNTIME_ENVS := 	$(MAIN_POSTGRES_ENVS) \
						FILE_STORAGE_DIR=$(FILE_STORAGE_DIR) \

COMMON_RUNTIME_ENVS := 	TLS_CERT=$(TLS_CERT) \
						TLS_KEY=$(TLS_KEY)

API_RUNTIME_ENVS := 	API_PORT=$(API_PORT) \
						STATIC_DIR=$(STATIC_DIR) \
						FILE_STORAGE_DIR=$(FILE_STORAGE_DIR) \
						DOCROOT_DIR=$(DOCROOT_DIR) \
						SESSION_SECRET=$(SESSION_SECRET) \
						SIM_HOST="127.0.0.1:$(SIM_PORT)"

SIM_RUNTIME_ENVS := 	SIM_PORT=$(SIM_PORT) \
						WS_RPC_HOST="127.0.0.1:$(WS_RPC_PORT)"

WS_RUNTIME_ENVS := 		WS_PORT=$(WS_PORT) \
						WS_RPC_PORT=$(WS_RPC_PORT) \
						SIM_HOST="127.0.0.1:$(SIM_PORT)"

SIM_GRPC_DIR := go/src/spaciblo.org/sim/rpc/
WS_GRPC_DIR := go/src/spaciblo.org/ws/rpc/

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
	protoc -I ${SIM_GRPC_DIR} ${SIM_GRPC_DIR}sim.proto --go_out=plugins=grpc:${SIM_GRPC_DIR}
	protoc -I ${WS_GRPC_DIR} ${WS_GRPC_DIR}ws.proto --go_out=plugins=grpc:${WS_GRPC_DIR}

compile: 
	go install -v $(MAIN_PKGS)

run_api: compile
	-mkdir $(FILE_STORAGE_DIR)
	$(COMMON_RUNTIME_ENVS) $(API_RUNTIME_ENVS) $(MAIN_POSTGRES_ENVS) go/bin/api

run_sim: compile
	-mkdir $(FILE_STORAGE_DIR)
	$(COMMON_RUNTIME_ENVS) $(SIM_RUNTIME_ENVS) $(MAIN_POSTGRES_ENVS) go/bin/sim

run_ws: compile
	-mkdir $(FILE_STORAGE_DIR)
	$(COMMON_RUNTIME_ENVS) $(WS_RUNTIME_ENVS) $(MAIN_POSTGRES_ENVS) go/bin/ws

run_all: compile
	-mkdir $(FILE_STORAGE_DIR)
	$(COMMON_RUNTIME_ENVS) $(API_RUNTIME_ENVS) $(SIM_RUNTIME_ENVS) $(WS_RUNTIME_ENVS) $(MAIN_POSTGRES_ENVS) go/bin/all_in_one

install_demo:
	-echo "drop database $(POSTGRES_DB_NAME); create database $(POSTGRES_DB_NAME);" | psql -U $(POSTGRES_USER)
	go install -v spaciblo.org/be/install_demo
	$(DEMO_RUNTIME_ENVS) $(GOBIN)/install_demo

test_sim:
	-echo "drop database $(POSTGRES_TEST_DB_NAME)" | psql -U $(POSTGRES_USER)
	$(TEST_POSTGRES_ENVS) go test -v spaciblo.org/sim/... -cwd="$(PWD)"

test:
	-echo "drop database $(POSTGRES_TEST_DB_NAME)" | psql -U $(POSTGRES_USER)
	$(TEST_POSTGRES_ENVS) go test -v spaciblo.org/api/... -cwd="$(PWD)"
	$(TEST_POSTGRES_ENVS) go test -v spaciblo.org/ws/...  -cwd="$(PWD)"
	$(TEST_POSTGRES_ENVS) go test -v spaciblo.org/sim/... -cwd="$(PWD)"
	$(TEST_POSTGRES_ENVS) go test -v spaciblo.org/be/...  -cwd="$(PWD)"

psql:
	scripts/db_shell.sh $(POSTGRES_USER) $(POSTGRES_PASSWORD) $(POSTGRES_DB_NAME)

