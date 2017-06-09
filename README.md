# Spaciblō Core

The Spaciblō project builds hosting tools for browser based, social, 3D spaces.

If you're new to Spaciblō, check out our handy [Frequently Asked Questions page](https://github.com/Spaciblo/spaciblo/wiki/Frequently-Asked-Questions) where you will find out what the heck this is and how to start playing with it. (It's neat, we promise!)

This repository, [Spaciblō Core](https://github.com/Spaciblo/spaciblo-core), holds the source code for the Spaciblō web service that hosts browser based, social, 3D spaces with voice chat. If you want to run your own virtual reality server then this repository is for you!

The [Spaciblō](https://github.com/Spaciblo/spaciblo) repository holds the project-wide documents and the [wiki](https://github.com/Spaciblo/spaciblo/wiki). 

The [Core development lists](https://github.com/orgs/Spaciblo/projects/1) show what we're working on and considering for the future.

# To build or not to build

To access a Spaciblō space, you just need a web browser. If you want to run your own Spaciblō services on your own machines then you'll need to build this repo (spaciblo-core) from source.

Eventually we'll offer binary distributions, but for now we've made the build process pretty straight-forward for people who are comfortable with a command line.

You'll need a Linux or OS X based environment that has [go](https://golang.org/) and PostgreSQL installed and in your PATH. The Spaciblō services can be run in a virtual machine, so if you're on Windows you can use [VirtualBox](https://www.virtualbox.org/) or some other VM to bring up a Linux based environment. Pretty much any modern distro will do.

# Building

In bash in the spaciblo-core dir, `source env.sh` to set up your Go environment variables.

The default `Makefile` target will use `go get` to fetch dependencies and then build the three Spaciblō service binaries: api, sim, and ws.

So, to build just run:

	make

## Database setup

Spaciblō works with PostgreSQL. Look at the top of the [Makefile](https://github.com/Spaciblo/spaciblo-core/blob/master/Makefile) for the username/password/database settings that the make targets use during development. You could change those, but for now just set up PostgreSQL to use the defaults.

## Development

During dev, it's handy to install demo accounts, templates, and a few spaces:

	make install_demo

There are three services that make up Spaciblō, but during development it's easiest to run them all together in one process like so:

	make run_all

Now, point your browser at [https://127.0.0.1:9000](https://127.0.0.1:9000/).

By default, the service uses a self-signed cert so you will need to reassure your browser that it's ok by creating a security exception. On firefox, you will need to do that for both the [web service](https://127.0.0.1:9000/) and for the [WebSocket service](https://127.0.0.1:9020/). On Chrome, a security exception for port 9000 will automatically apply to port 9020.

Now, click one of the space names listed in the middle of the page to enter a space. Use the arrow keys or WASD to move around.

Point a second browser at the same URL and they'll see each others' avatars and (WebRTC willing) be able to hear each other.

If your machine is recognized by WebVR as VR-ready then you'll see a link in the bottom right hand corner that will let you enter the space in VR. 

If you used `install_demo` to set up accounts then you can log in on the [account page](https://127.0.0.1:9000/a/) using the email/password of alice@example.com/1234 to gain access to the [inventory](https://127.0.0.1:9000/i/) where you will find the template, space, and avatar editors. There you can upload new 3D art, arrange them in spaces, and manipulate the avatars that are available to your users.

## Generating new protobuf code

You shouldn't need to do this unless you change one of the *.proto files, but if you do that then do this to generate new go code for gRPC:

[Download the 3.1.0 protobuf compiler](https://github.com/google/protobuf/releases) for your platform and install it beside spaciblo-core such that the `protoc` directory is in `../protoc-3.1.0/bin/` relative to the root of spaciblo-core.

The 'make generate_protobuf' target will generate the service code in api.pb.go, sim.pb.go, and ws.pb.go.

# Running a public server

All three of the Spaciblō services (web api, web socket service, and simulator) are configured by environment variables so that it is possible to deploy them into a container service like Docker. Check out the `run_api`, `run_sim` and `run_ws` make targets for examples of how to run each service.

For a quick and dirty public server, it's easiest to use the all-in-one process like in the `run_all` make target.

If you use the `run_all` make target (and thus the default ports) and want to access the service through a firewall or inside a cloud security group, you'll need to open up port 9000 (HTTPS) and 9020 (WebSocket to sim proxy).

No web browser will enter VR unless the service is running over HTTPS connections, so you'll need to either use the bogus cert that is in the repo or change the TLS_CERT and TLS_KEY environment variables to point at your valid cert files.

# API requests

The web API requires an Accept header, like so:

	curl -H "Accept: application/vnd.api+json; version=0.1.0" --insecure https://127.0.0.1:9000/api/0.1.0/SOME_ENDPOINT
