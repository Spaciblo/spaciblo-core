'use strict'

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

// Names of settings that represent the position/orientation/motion of a scene node
spaciblo.api.PositioningSettingsNames = ['position', 'orientation', 'rotation', 'translation', 'scale']

// Settings that are not displayed in the space editor settings
spaciblo.api.IgnoredSettings = ['id', 'clientUUID']

// Names of settings that represent lighting of a scene node
spaciblo.api.LightingSettingsNames = ['light-color', 'light-distance', 'light-intensity', 'light-target', 'light-type']

// Values for the lighting-type node setting
spaciblo.api.LightingTypes = ['ambient', 'directional', 'point', 'spot', 'hemisphere']


spaciblo.api.Client = k.eventMixin(class {
	constructor(serviceURL=spaciblo.api.Client.ServiceURL){
		this.serviceURL = serviceURL
		this.socket = null
		this.space = null
	}
	cleanup(){
		if(this.socket){
			this.socket.close()
		}
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
	joinSpace(space, avatar=true){
		if(this.socket === null){
			throw 'Can not join a space when the Client is not open'
		}
		if(this.space !== null){
			throw 'Client is already connecting/ed to a space'
		}
		this.space = space
		this.socket.send(JSON.stringify({
			type: 'Join-Space',
			uuid: this.space.get('uuid'),
			avatar: avatar
		}))
	}
	sendSettingRequest(nodeId, name, value){
		if(this.space === null) return
		let nodeUpdate = {
			id: nodeId,
			settings: {}
		}
		nodeUpdate.settings[name] = value
		this.socket.send(JSON.stringify({
			type: 'Update-Request',
			spaceUUID: this.space.get('uuid'),
			nodeUpdates: [ nodeUpdate ]
		}))
	}
	sendUpdateRequest(nodeId, name, value){
		if(this.space === null) return
		let nodeUpdate = { id: nodeId }
		nodeUpdate[name] = value
		this.socket.send(JSON.stringify({
			type: 'Update-Request',
			spaceUUID: this.space.get('uuid'),
			nodeUpdates: [ nodeUpdate ]
		}))
	}
	sendAvatarUpdate(position, orientation, bodyUpdates, translation, rotation){
		if(this.space === null) return
		let update = {
			type: 'Avatar-Motion',
			spaceUUID: this.space.get('uuid'),
			bodyUpdates: bodyUpdates,
			position: position,
			orientation: orientation,
			translation: translation,
			rotation: rotation,
			scale: [1, 1, 1]
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
		console.error('Error in Client', arguments)
	}
	_onMessage(event){
		this.trigger(spaciblo.events.ClientMessageReceived, JSON.parse(event.data))
	}
})

spaciblo.api.handleSchemaPopulated = function(){
	be.api.Template.prototype.sourceURL = function(){
		return `/api/${be.API_VERSION}/template/${this.get('uuid')}/data/${this.get('source')}`
	}
	be.api.Template.prototype.getBaseURL = function(){
		return `/api/${be.API_VERSION}/template/${this.get('uuid')}/data/`
	}
	be.api.Template.prototype.getSourceExtension = function(){
		const source = this.get('source')
		if(source == null || source == '' || source.indexOf('.') == -1){
			return null
		}
		return source.split('.')[source.split('.').length - 1].toLowerCase()
	}

	be.api.TemplateData.postFile = function(templateUUID, file){
		return new Promise((resolve, reject) => {
			const url = `/api/${be.API_VERSION}/template/${templateUUID}/data/`
			const data = new FormData()
			data.append('file', file)
			const headers = new Headers()
			headers.set('Accept', be.schema.acceptFormat + be.API_VERSION)
			const fetchOptions = {
				method: 'post',
				body: data,
				headers: headers,
				credentials: 'same-origin' // So that cookies are sent and handled when received
			}
			fetch(url, fetchOptions).then(response => {
				if(response.status === 200){
					return response.json()
				} else {
					console.error('Failed to post TemplateData', response)
					throw 'Failed with status: ' + response.status
				}
			}).then(data => {
				resolve(new be.api.TemplateData(data))
			}).catch(err => {
				reject(err)
			})
		})
	}
}
document.addEventListener('schema-populated', spaciblo.api.handleSchemaPopulated)
