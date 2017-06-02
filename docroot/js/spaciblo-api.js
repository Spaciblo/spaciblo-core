'use strict'

/*
spaciblo-api contains:
- modifications to schema generated models and collections in be.api 
- spaciblo.api.Client talks to the WS service (and thus the simulation back end)
*/

var spaciblo = spaciblo || {}
spaciblo.api = spaciblo.api || {}
spaciblo.events = spaciblo.events || {}

spaciblo.api.WEBSOCKET_PATH = '/ws'
spaciblo.api.WEBSOCKET_PORT = 9020 // TODO stop hard coding this port

spaciblo.events.ClientOpened = 'spaciblo-client-opened'
spaciblo.events.ClientMessageReceived = 'spaciblo-client-message-received'

// Send by the client to indicate that a key should be removed.
spaciblo.api.RemoveKeyIndicator = '_r_e_m_o_v_e_'

// Names of settings that represent the position/orientation/motion of a scene node
spaciblo.api.PositioningSettingsNames = ['position', 'orientation', 'rotation', 'translation', 'scale']

// Settings that are not displayed in the space editor settings
spaciblo.api.IgnoredSettings = ['id', 'clientUUID', 'templateUUID']

// Names of settings that represent lighting of a scene node
spaciblo.api.LightingSettingsNames = ['light-color', 'light-distance', 'light-intensity', 'light-target', 'light-type', 'light-decay', 'light-penumbra', 'light-angle', 'light-sky-color', 'light-ground-color']

// Values for the lighting-type node setting
spaciblo.api.LightingTypes = ['ambient', 'directional', 'point', 'spot', 'hemisphere']

/*
Client connects to the WS service (and thus the simulation back end) via a WebSocket.
It can request to join a space, send scene graph node updates, and send avatar movement updates.
It receives replication and communication updates from the back end. 
*/
spaciblo.api.Client = k.eventMixin(class {
	constructor(serviceURL=spaciblo.api.Client.ServiceURL){
		this.serviceURL = serviceURL
		this.socket = null // a WebSocket
		this.space = null  // a Space model
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
				// Uncomment this only during debugging a new controller type, never in production.
				// this._startGamepadInfoMessages()
				resolve()
			}
			this.socket.onerror = () => {
				this.socket.onerror = this._onError.bind(this)
				reject()
			}
		})
	}
	/*
	This is used during development when adding a new controller type.
	It sends a Debug-Log message to the backend with information about the current gamepad state.
	*/
	_startGamepadInfoMessages(){
		setInterval(() => {
			this.socket.send(JSON.stringify({
				type: 'Debug-Log',
				gamepads: spaciblo.input.getGamepadInfo()
			}))
		}, 1000)
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
		let settings = {}
		settings[name] = value
		this.sendSettingsRequest(nodeId, settings)
	}
	sendSettingsRequest(nodeId, settings){
		if(this.space === null) return
		let nodeUpdate = {
			id: nodeId,
			settings: settings
		}
		this.socket.send(JSON.stringify({
			type: 'Update-Request',
			spaceUUID: this.space.get('uuid'),
			nodeUpdates: [ nodeUpdate ]
		}))
	}
	sendRemoveNode(nodeId){
		if(this.space === null) return
		this.socket.send(JSON.stringify({
			type: 'Remove-Node-Request',
			spaceUUID: this.space.get('uuid'),
			id: nodeId
		}))
	}
	sendAddNode(parentId, settings={}, position=[0,0,0], orientation=[0,0,0,1], rotation=[0,0,0], translation=[0,0,0], scale=[1,1,1], leader=0){
		if(this.space === null) return
		this.socket.send(JSON.stringify({
			type: 'Add-Node-Request',
			parent: parentId,
			spaceUUID: this.space.get('uuid'),
			settings: settings,
			position: position,
			orientation: orientation,
			rotation: rotation,
			translation: translation,
			scale: scale,
			leader: leader
		}))
	}
	sendUpdateRequest(nodeId, name, value){
		if(this.space === null) return
		let nodeUpdate = { id: nodeId }
		nodeUpdate[name] = value
		this.sendUpdatesRequest([nodeUpdate])
	}
	sendUpdatesRequest(updates){
		/*
		updates must be an array of { id: <nodeID>, <key>:<value> } maps
		*/
		this.socket.send(JSON.stringify({
			type: 'Update-Request',
			spaceUUID: this.space.get('uuid'),
			nodeUpdates: updates
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
	sendRelaySDP(description, destinationClientUUID){
		let message = {
			type: 'Relay-SDP',
			destinationClientUUID: destinationClientUUID,
			description: description
		}
		this.socket.send(JSON.stringify(message))
	}
	sendRelayICE(candidate, destinationClientUUID){
		let message = {
			type: 'Relay-ICE',
			destinationClientUUID: destinationClientUUID,
			candidate: candidate
		}
		this.socket.send(JSON.stringify(message))
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
	/*
	Once the schema is loaded, we update the models and collections in be.api with custom logic.
	*/
	be.api.Template.prototype.geometryURL = function(){
		if(this.get('geometry')){
			return `${this.getBaseURL()}${this.get('geometry')}`
		}
		return null
	}
	be.api.Template.prototype.clientScriptURL = function(){
		if(this.get('clientScript')){
			return `${this.getBaseURL()}${this.get('clientScript')}`
		}
		return null
	}
	be.api.Template.prototype.simScriptURL = function(){
		if(this.get('simScript')){
			return `${this.getBaseURL()}${this.get('simScript')}`
		}
		return null
	}
	be.api.Template.prototype.getBaseURL = function(){
		return `/api/${be.API_VERSION}/template/${this.get('uuid')}/data/`
	}
	be.api.Template.prototype.getGeometryExtension = function(){
		const geometry = this.get('geometry')
		if(geometry == null || geometry == '' || geometry.indexOf('.') == -1){
			return null
		}
		return geometry.split('.')[geometry.split('.').length - 1].toLowerCase()
	}

	be.api.TemplateData.prototype.getDataURL = function(templateUUID){
		return `/api/${be.API_VERSION}/template/${templateUUID}/data/` + encodeURIComponent(this.get('name'))
	}

	be.api.TemplateData.prototype.getData = function(templateUUID){
		return new Promise((resolve, reject) => {
			const headers = new Headers()
			headers.set('Accept', be.schema.acceptFormat + be.API_VERSION)
			const fetchOptions = {
				method: 'get',
				headers: headers,
				credentials: 'same-origin' // So that cookies are sent and handled when received
			}
			fetch(this.getDataURL(templateUUID), fetchOptions).then(response => {
				if(response.status === 200){
					resolve(response.text())
					return
				}
				throw 'Failed with status: ' + response.status
			}).catch(err => {
				reject(err)
			})
		})
	}

	be.api.TemplateData.prototype.saveText = function(templateUUID, text){
		return new Promise((resolve, reject) => {
			const headers = new Headers()
			headers.set('Accept', be.schema.acceptFormat + be.API_VERSION)
			const fetchOptions = {
				body: text,
				method: 'put',
				headers: headers,
				credentials: 'same-origin' // So that cookies are sent and handled when received
			}
			fetch(this.getDataURL(templateUUID), fetchOptions).then(response => {
				if(response.status === 200){
					resolve()
					return
				}
				throw 'Failed with status: ' + response.status
			}).catch(err => {
				reject(err)
			})
		})
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

	be.api.Flock.prototype.getMembers = function(){
		if(typeof this._members !== 'undefined'){
			return this._members
		}
		this._members = new be.api.FlockMembers([], { 'flock-uuid': this.get('uuid') })
		this._members.fetch()
		return this._members
	}
	be.api.Flocks.prototype.getActiveFlock = function(){
		for(let flock of this){
			if(flock.get('active') === true) return flock
		}
		return null
	}
	be.api.FlockMember.prototype.getFloatArray = function(fieldName, defaultValue=null){
		return this.parseFloatArray(this.get(fieldName), defaultValue)
	}
	be.api.FlockMember.prototype.parseFloatArray = function(value, defaultValue=null){
		if(typeof value === 'undefined' || value === null || value === '') return defaultValue
		let tokens = value.split(',')
		let results = []
		for(let token of tokens){
			let val = parseFloat(token)
			if(Number.isNaN(val)){
				val = 0
			}
			results[results.length] = val
		}
		return results
	}
}
document.addEventListener('schema-populated', spaciblo.api.handleSchemaPopulated)
