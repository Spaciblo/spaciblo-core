"use strict"

/*
spaciblo-components contains:
	modifications to the default models and collections created in be.api
	the WebSocket client that talks to the sim host
*/

var spaciblo = spaciblo || {}
spaciblo.api = spaciblo.api || {}
spaciblo.events = spaciblo.events || {}

spaciblo.api.WEBSOCKET_PATH = '/ws'
spaciblo.api.WEBSOCKET_PORT = 9020 // TODO stop hard coding this port

spaciblo.events.ClientOpened = 'spaciblo-client-opened'
spaciblo.events.ClientMessageReceived = 'spaciblo-client-message-received'

spaciblo.api.Client = k.eventMixin(class {
	constructor(serviceURL=spaciblo.api.Client.ServiceURL){
		this.serviceURL = serviceURL
		this.socket = null
		this.space = null
	}
	open(){
		return new Promise((resolve, reject) => {
			if(this.socket !== null){
				throw 'Client is already open'
			}
			this.socket = new WebSocket(this.serviceURL)
			this.socket.onmessage = this._onMessage.bind(this)

			this.socket.onopen = () => {
				this.socket.onopen = this._onOpen.bind(this)
				resolve()
			}
			this.socket.onerror = () => {
				this.socket.onerror = this._onError.bind(this)
				reject()
			}
		})
	}
	joinSpace(space){
		if(this.socket === null){
			throw 'Can not join a space when the Client is not open'
		}
		if(this.space !== null){
			throw 'Client is already connecting/ed to a space'
		}
		this.space = space
		this.socket.send(JSON.stringify({
			type: 'Join-Space',
			uuid: this.space.get('uuid')
		}))
	}
	sendAvatarUpdate(position, orientation, bodyUpdates, translation, rotation){
		if(this.space === null){
			// Not connected to a space, so nobody cares where we move
			return
		}
		let update = {
			type: 'Avatar-Motion',
			spaceUUID: this.space.get('uuid'),
			position: position,
			orientation: orientation,
			bodyUpdates: bodyUpdates,
			translation: translation,
			rotation: rotation,
			scale: [1, 1, 1],
		}
		this.socket.send(JSON.stringify(update))
	}
	static get ServiceURL(){
		const host = document.location.host.split(':')[0]
		return 'wss://' + host + ':' + spaciblo.api.WEBSOCKET_PORT + spaciblo.api.WEBSOCKET_PATH
	}
	_onOpen(event){
		this.trigger(spaciblo.events.ClientOpened, this)
	}
	_onError(event){
		console.error("Error in Client", arguments)
	}
	_onMessage(event){
		this.trigger(spaciblo.events.ClientMessageReceived, JSON.parse(event.data))
	}
})

spaciblo.api.handleSchemaPopulated = function(){
	be.api.Template.prototype.sourceURL = function(){
		return `/api/${be.API_VERSION}/template/${this.get("uuid")}/data/${this.get("source")}`
	}
	be.api.Template.prototype.getBaseURL = function(){
		return `/api/${be.API_VERSION}/template/${this.get("uuid")}/data/`	
	}
	be.api.Template.prototype.getSourceExtension = function(){
		const source = this.get('source')
		if(source == null || source == "" || source.indexOf('.') == -1){
			return null
		}
		return source.split('.')[source.split('.').length - 1].toLowerCase()
	}
}
document.addEventListener("schema-populated", spaciblo.api.handleSchemaPopulated)
