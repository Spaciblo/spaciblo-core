"use strict";

var spaciblo = spaciblo || {}
spaciblo.audio = spaciblo.audio || {}
spaciblo.events = spaciblo.events || {}

spaciblo.events.GeneratedSDPLocalDescription = 'generated-sdp-local-description'
spaciblo.events.GeneratedICECandidate = 'generated-ice-candidate'

// TODO Run our own STUN/ICE service
spaciblo.audio.DEFAULT_STUN_URLS = [
	'stun:stun.services.mozilla.com',
	'stun:stun.l.google.com:19302'
]

/*
SpaceManager keeps track of all of the WebRTC audio connections for a space.
The connections are peer-to-peer via WebRTC

TODO give the user control over the main gain and remote user gains in flat and VR modes
*/
spaciblo.audio.SpaceManager = k.eventMixin(class {
	constructor(stunURLs=spaciblo.audio.DEFAULT_STUN_URLS){
		this._stunURLs = stunURLs
		this._microphoneStream = null
		this._remoteUsers = new Map() // clientUUID => RemoteUser
		this._audioContext = new AudioContext()
		this._mainGain = this._audioContext.createGain() // The master volume for the space, fed by the panners in RemoteUsers
		this._mainGain.connect(this._audioContext.destination)
	}
	cleanup(){
		super.cleanup()
		this._remoteUsers.forEach((clientUUID, remoteUser) => { remoteUser.cleanup() })
		this._remoteUsers.clear()
		this._audioContext.close()
	}
	setHeadPositionAndOrientation(
		positionX, positionY, positionZ, 
		directionX, directionY, directionZ, 
		upX, upY, upZ
	){
		// Called with each render frame to set the local user's audio listener
		this._audioContext.listener.setPosition(positionX, positionY, positionZ)
		this._audioContext.listener.setOrientation(directionX, directionY, directionZ, upX, upY, upZ)
	}
	setRemoteUserPositionAndOrientation(
		clientUUID,
		positionX, positionY, positionZ,
		directionX, directionY, directionZ,
		upX, upY, upZ
	){
		// Called with each render frame to set the remote user's audio panner
		// TODO figure out whether we should have remote users be directional sounds
		let remoteUser = this._remoteUsers.get(clientUUID)
		if(typeof remoteUser === 'undefined') return
		remoteUser.setPosition(positionX, positionY, positionZ)
		remoteUser.setOrientation(directionX, directionY, directionZ, upX, upY, upZ)
	}
	getRemoteUser(clientUUID, addIfAbsent=false){
		let remoteUser = this._remoteUsers.get(clientUUID)
		if(typeof remoteUser === 'undefined'){
			if(addIfAbsent === false){
				return null
			}
			return this.addRemoteUser(clientUUID)
		}
		return remoteUser
	}
	addRemoteUser(clientUUID){
		let remoteUser = new spaciblo.audio.RemoteUser(clientUUID, this._audioContext, this._mainGain, this.peerConnectionConfig)
		if(this._microphoneStream) remoteUser.addAudioStream(this._microphoneStream)
		this._remoteUsers.set(clientUUID, remoteUser)
		remoteUser.addListener((...params) => { this.trigger(...params) }, spaciblo.events.GeneratedSDPLocalDescription)
		remoteUser.addListener((...params) => { this.trigger(...params) }, spaciblo.events.GeneratedICECandidate)
		return remoteUser
	}
	removeRemoteUser(clientUUID){
		let remoteUser = this._remoteUsers.get(clientUUID)
		if(!remoteUser) return
		this._remoteUsers.delete(clientUUID)
		remoteUser.cleanup()
	}
	connectToLocalMicrophone(){
		return new Promise((resolve, reject) => {
			if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				reject('This browser does not provide access to the microphone')
				return
			}
			navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then(stream => {
				this._microphoneStream = stream
				resolve(stream)
			}).catch((...params) => {
				reject(...params)
			})
		})
	}
	get peerConnectionConfig(){
		let config = { iceServers: [] }
		for(let url of this._stunURLs){
			config.iceServers.push({ urls: url })
		}
		return config
	}
})

/*
RemoteUser holds the RTCPeerConnection to a user in the same space, usually managed by SpaceManager
*/
spaciblo.audio.RemoteUser = k.eventMixin(class {
	constructor(remoteClientUUID, audioContext, destinationAudioNode, peerConnectionConfig){
		this._remoteClientUUID = remoteClientUUID
		this._audioContext = audioContext
		this._destinationAudioNode = destinationAudioNode
		this._peerConnectionConfig = peerConnectionConfig

		this._peerConnection = new RTCPeerConnection(this._peerConnectionConfig)
		this._peerConnection.ontrack = this._handlePeerTrack.bind(this)
		this._peerConnection.onicecandidate = this._handlePeerICECandidate.bind(this)

		// _audioSourceNode -> _analysisNode -> _gainNode -> _pannerNode -> _destinationAudioNode

		this._pannerNode = this._audioContext.createPanner() // This is updated with the remote user's position during each frame
		this._pannerNode.connect(this._destinationAudioNode)
		this._gainNode = this._audioContext.createGain() // This user's individual gain, seperate from the SpaceManager._mainGain
		this._gainNode.connect(this._pannerNode)
		this._analysisNode = this._audioContext.createAnalyser()
		this._analysisNode.connect(this._gainNode)

		this._audioSourceNode = null // a MediaStreamAudioSourceNode created from the WebRTC track stream

	}
	cleanup(){
		this.clearListeners()
		if(this._peerConnection){
			this._peerConnection.close()
		}
		if(this._audioSourceNode) {
			this._audioSourceNode.disconnect()
			this._audioSourceNode = null
		}
		if(this._analysisNode){
			this._analysisNode.disconnect()
			this._analysisNode = null
		}
		if(this.gainNode){
			this._gainNode.disconnect()
			this._gainNode = null
		}
		if(this._pannerNode){
			this._pannerNode.disconnect()
			this._pannerNode = null
		}
	}
	setPosition(x, y, z){
		this._pannerNode.setPosition(x, y, z)
	}
	setOrientation(directionX, directionY, directionZ, upX, upY, upZ){
		this._pannerNode.setOrientation(directionX, directionY, directionZ, upX, upY, upZ)
	}
	handleSessionDescription(sdp){
		sdp = JSON.parse(sdp)
		this._peerConnection.setRemoteDescription(new RTCSessionDescription(sdp)).then(() => {
			if(sdp.type === 'offer') {
				this._peerConnection.createAnswer().then(description => {
					this._peerConnection.setLocalDescription(description).then(() => {
						this.trigger(spaciblo.events.GeneratedSDPLocalDescription, JSON.stringify(this._peerConnection.localDescription), this._remoteClientUUID)
					}).catch((...params) => {
						console.error(...params)
					})
				})
			}
		}).catch((...params) => {
			console.error(...params)
		})
	}
	handleICECandidate(candidate){
		candidate = JSON.parse(candidate)
		this._peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch((...params) => {
			console.error(...params)
		})
	}
	addAudioStream(audioStream){
		this._peerConnection.addStream(audioStream)
	}
	sendSessionOffer(){
		this._peerConnection.createOffer().then(description => {
			this._peerConnection.setLocalDescription(description).then(() => {
				this.trigger(spaciblo.events.GeneratedSDPLocalDescription, JSON.stringify(this._peerConnection.localDescription), this._remoteClientUUID)
			}).catch((...params) => {
				console.error(...params)
			})
		}).catch((...params) => {
			console.error(...params)
		})
	}
	_handlePeerICECandidate(event){
		if(event.candidate === null) {
			return
		}
		this.trigger(spaciblo.events.GeneratedICECandidate, JSON.stringify(event.candidate), this._remoteClientUUID)
	}
	_handlePeerTrack(track){
		if(track.track.kind !== 'audio'){
			console.error("Unknown track kind", track.track.kind, track)
			return
		}
		if(this._audioSourceNode !== null){
			console.error('Added an audio track for a remote user with an existing audio source node', track, this)
			return
		}
		let audioEl = k.el.audio().appendTo(document.getElementById('page-component'))
		audioEl.srcObject = track.streams[0]
		this._audioSourceNode = this._audioContext.createMediaStreamSource(track.streams[0])
		this._audioSourceNode.connect(this._analysisNode)
		/*
		var visualizer = new spaciblo.components.AudioVisualizer(this._analysisNode)
		document.getElementById('page-component').appendChild(visualizer.el)
		visualizer.start()
		*/
	}
})