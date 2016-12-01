.PHONY: clean clean_deps go_get_deps lint compile_api install_demo test psql

PORT := 9000
FRONT_END_DIR = $(PWD)/docroot

POSTGRES_USER := trevor
POSTGRES_PASSWORD := seekret
POSTGRES_HOST := localhost
POSTGRES_PORT := 5432

POSTGRES_DB_NAME := be
POSTGRES_TEST_DB_NAME := be_test

SESSION_SECRET := "fr0styth3sn0wm@n"

STATIC_DIR := $(PWD)/go/src/spaciblo.org/be/static/
FILE_STORAGE_DIR := $(PWD)/file_storage

API_PKGS := spaciblo.org/...

COMMON_POSTGRES_ENVS := POSTGRES_USER=$(POSTGRES_USER) \
						POSTGRES_PASSWORD=$(POSTGRES_PASSWORD) \
						POSTGRES_HOST=$(POSTGRES_HOST) \
						POSTGRES_PORT=$(POSTGRES_PORT)

API_POSTGRES_ENVS :=	$(COMMON_POSTGRES_ENVS) \
						POSTGRES_DB_NAME=$(POSTGRES_DB_NAME)

TEST_POSTGRES_ENVS := 	$(COMMON_POSTGRES_ENVS) \
						POSTGRES_DB_NAME=$(POSTGRES_TEST_DB_NAME) 

API_RUNTIME_ENVS := 	PORT=$(PORT) \
						STATIC_DIR=$(STATIC_DIR) \
						FILE_STORAGE_DIR=$(FILE_STORAGE_DIR) \
						FRONT_END_DIR=$(FRONT_END_DIR) \
						SESSION_SECRET=$(SESSION_SECRET) \
						$(API_POSTGRES_ENVS)

all: go_get_deps compile_api

clean:
	rm -rf go/bin go/pkg deploy collect

clean_deps:
	rm -rf go/src/github.com go/src/golang.org go/src/gopkg.in

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
	go get golang.org/x/crypto/bcrypt
	go get gopkg.in/gorp.v2

lint:
	go install github.com/golang/lint/...
	golint spaciblo.org/...

compile_api: 
	go install -v $(API_PKGS)

run_front: compile_api
	-mkdir $(FILE_STORAGE_DIR)
	$(API_RUNTIME_ENVS) go/bin/front

install_demo:
	-echo "drop database $(POSTGRES_DB_NAME); create database $(POSTGRES_DB_NAME);" | psql
	go install -v spaciblo.org/be/demo
	$(API_POSTGRES_ENVS) $(GOBIN)/demo

test:
	-echo "drop database $(POSTGRES_TEST_DB_NAME)" | psql
	$(TEST_POSTGRES_ENVS) go test -v spaciblo.org/...

psql:
	scripts/db_shell.sh $(POSTGRES_USER) $(POSTGRES_PASSWORD)

