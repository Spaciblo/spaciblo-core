'use strict'

/*
spaciblo-api-websocket contains:
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

// Settings that are not displayed as raw string editable settings in the space editor settings
spaciblo.api.IgnoredSettings = ['id', 'clientUUID', 'templateUUID', 'visible']

// Names of settings that represent lighting of a scene node
spaciblo.api.LightingSettingsNames = ['light-color', 'light-distance', 'light-intensity', 'light-target', 'light-type', 'light-decay', 'light-penumbra', 'light-angle', 'light-sky-color', 'light-ground-color']

// Values for the lighting-type node setting
spaciblo.api.LightingTypes = ['ambient', 'directional', 'point', 'spot', 'hemisphere']

// true if the id is of the form 'abwkjh-asldkjar-eralkj' (like a flock member's UUID) instead of an integer like a numeric sim node id 
spaciblo.api.isFlockId = function(groupId){
	return groupId && groupId.length > 10 && groupId.includes('-')
}

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
	sendFlockMemberUpdateRequest(update){
		/*
		update must be a map like { uuid: <flockMemberUUID>, <key>:<value> }
		*/
		this.socket.send(JSON.stringify({
			type: 'Flock-Member-Update-Request',
			flockMemberUpdates: [update]
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

