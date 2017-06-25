"use strict";

var spaciblo = spaciblo || {}
spaciblo.audio = spaciblo.audio || {}
spaciblo.events = spaciblo.events || {}

spaciblo.events.GeneratedSDPLocalDescription = 'generated-sdp-local-description'
spaciblo.events.GeneratedICECandidate = 'generated-ice-candidate'
spaciblo.events.AudioRemoteUserAdded = 'audio-remote-user-added'
spaciblo.events.AudioRemoteUserRemoved = 'audio-remote-user-removed'

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
		this._remoteUsers = new Map() // clientUUID => RemoteUser
		this._audioContext = new AudioContext()

		// _microphoneStream -> _microphoneNode -> _microphoneGainNode -> _microphoneAnalysisNode -> _microphoneDestinationNode
		this._microphoneDestinationNode = this._audioContext.createMediaStreamDestination()
		this._microphoneAnalysisNode = this._audioContext.createAnalyser()
		this._microphoneAnalysisNode.connect(this._microphoneDestinationNode)
		this._microphoneGainNode = this._audioContext.createGain()
		this._microphoneGainNode.connect(this._microphoneAnalysisNode)

		this._microphoneIsMuted = false

		// _microphoneStream and _microphoneNode will be set and connected in connectToLocalMicrophone
		this._microphoneNode = null
		this._microphoneStream = null

		// RemoteUser x N -> _mainAnalysisNode -> _mainGainNode -> _audioContext.destination
		this._mainGainNode = this._audioContext.createGain() // The master volume for the space, fed by the panners in RemoteUsers
		this._mainGainNode.connect(this._audioContext.destination)
		this._mainAnalysisNode = this._audioContext.createAnalyser()
		this._mainAnalysisNode.connect(this._mainGainNode)
	}
	cleanup(){
		super.cleanup()
		this._remoteUsers.forEach((clientUUID, remoteUser) => { remoteUser.cleanup() })
		this._remoteUsers.clear()
		this._audioContext.close()
	}
	get microphoneAnalysisNode(){
		return this._microphoneAnalysisNode
	}
	get mainGainNode(){
		return this._mainGainNode
	}
	get mainAnalysisNode(){
		return this._mainAnalysisNode
	}
	get microphoneIsMuted(){
		return this._microphoneIsMuted
	}
	toggleMicrophoneMute(){
		this.setMicrophoneMute(!this._microphoneIsMuted)
	}
	setMicrophoneMute(mute){
		if(mute){
			this._microphoneIsMuted = true
			this._microphoneGainNode.gain.value = 0
		} else {
			this._microphoneIsMuted = false
			this._microphoneGainNode.gain.value = 1
		}
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
	getRemoteUserLevel(clientUUID){
		let remoteUser = this._remoteUsers.get(clientUUID)
		if(typeof remoteUser === 'undefined'){
			return 0
		}
		return remoteUser.level
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
		let remoteUser = new spaciblo.audio.RemoteUser(clientUUID, this._audioContext, this._microphoneDestinationNode.stream, this._mainAnalysisNode, this.peerConnectionConfig)
		this._remoteUsers.set(clientUUID, remoteUser)
		remoteUser.addListener((...params) => { this.trigger(...params) }, spaciblo.events.GeneratedSDPLocalDescription)
		remoteUser.addListener((...params) => { this.trigger(...params) }, spaciblo.events.GeneratedICECandidate)
		this.trigger(spaciblo.events.AudioRemoteUserAdded, remoteUser)
		return remoteUser
	}
	removeRemoteUser(clientUUID){
		let remoteUser = this._remoteUsers.get(clientUUID)
		if(!remoteUser) return
		this._remoteUsers.delete(clientUUID)
		this.trigger(spaciblo.events.AudioRemoteUserRemoved, remoteUser)
		remoteUser.cleanup()
	}
	connectToLocalMicrophone(){
		if(this._microphoneStream !== null){
			return new Promise((resolve, reject) => {
				resolve(this._microphoneStream)
			})
		}
		return new Promise((resolve, reject) => {
			if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				reject('This browser does not provide access to the microphone')
				return
			}
			navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
				this._microphoneStream = stream
				this._microphoneNode = this._audioContext.createMediaStreamSource(this._microphoneStream)
				this._microphoneNode.connect(this._microphoneGainNode)
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
	constructor(remoteClientUUID, audioContext, inputStream, destinationAudioNode, peerConnectionConfig){
		this._remoteClientUUID = remoteClientUUID
		this._audioContext = audioContext
		this._destinationAudioNode = destinationAudioNode
		this._peerConnectionConfig = peerConnectionConfig

		this._isMuted = false
		this._oldGain = 0

		this._peerConnection = new RTCPeerConnection(this._peerConnectionConfig)
		this._peerConnection.addStream(inputStream)
		if(typeof this._peerConnection.ontrack !== 'undefined'){
			this._peerConnection.ontrack = this._handlePeerTrack.bind(this)
			this._audioEl = null
		} else {
			// The older WebRTC API clients (Chrome) require an <audio> element to be associated with the stream
			this._peerConnection.onaddstream = this._handlePeerStream.bind(this)
			this._audioEl = k.el.audio().appendTo(document.body)
		}
		this._peerConnection.onicecandidate = this._handlePeerICECandidate.bind(this)

		// _audioSourceNode -> _analysisNode -> _levelAnalysisNode -> _gainNode -> _pannerNode -> _destinationAudioNode

		this._pannerNode = this._audioContext.createPanner() // This is updated with the remote user's position during each frame
		this._pannerNode.connect(this._destinationAudioNode)
		this._gainNode = this._audioContext.createGain() // This user's individual gain, seperate from the SpaceManager._mainGainNode
		this._gainNode.connect(this._pannerNode)
		this._levelAnalysisNode = this._audioContext.createAnalyser()
		this._levelAnalysisNode.connect(this._gainNode)
		this._analysisNode = this._audioContext.createAnalyser()
		this._analysisNode.connect(this._levelAnalysisNode)

		// The level analysis node is only used to determine DB level, so we use the smallest allowed FFT size
		this._levelAnalysisNode.fftSize = 32
		this._levelAnalysisNode.smoothingTimeConstant = 0
		this._levelBufferLength = this._levelAnalysisNode.frequencyBinCount
		this._levelDataArray = new Uint8Array(this._levelBufferLength)

		this._audioSourceNode = null // a MediaStreamAudioSourceNode created from the WebRTC track stream
	}
	cleanup(){
		this.clearListeners()
		if(this._audioEl !== null) this._audioEl.remove()
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
	get isMuted(){
		return this._isMuted
	}
	toggleMuted(){
		this.setMuted(this._isMuted === false)
	}
	setMuted(mute){
		if(this._isMuted === mute) return
		this._isMuted = mute
		if(this._isMuted){
			this._oldGain = this._gainNode.gain.value
			this._gainNode.gain.value = 0
		} else {
			this._gainNode.gain.value = this._oldGain
		}
	}
	get level(){
		// returns a number in the range of 0 to 1 representing the current DB level of this remote user
		if(this._isMuted) return 0
		this._levelAnalysisNode.getByteFrequencyData(this._levelDataArray)
		let sum = 0
		for (var i = 0; i < this._levelBufferLength; i++) {
			sum += this._levelDataArray[i] / 128.0
		}
		return sum / this._levelBufferLength // Value in range [0,1]
	}
	get clientUUID(){
		return this._remoteClientUUID
	}
	get analysisNode(){
		return this._analysisNode
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
	_handlePeerStream(event){
		// This is called when we're using the older onaddstream WebRTC API
		this._audioEl.srcObject = event.stream // Chrome requires the stream be associated with an <audio> element
		this._audioSourceNode = this._audioContext.createMediaStreamSource(event.stream)
		this._audioSourceNode.connect(this._analysisNode)
	}
	_handlePeerTrack(track){
		// This is called when we're using the newer ontrack WebRTC API
		if(track.track.kind !== 'audio'){
			console.error("Unknown track kind", track.track.kind, track)
			return
		}
		if(this._audioSourceNode !== null){
			console.error('Added an audio track for a remote user with an existing audio source node', track, this)
			return
		}
		this._audioSourceNode = this._audioContext.createMediaStreamSource(track.streams[0])
		this._audioSourceNode.connect(this._analysisNode)
	}
})