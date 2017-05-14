"use strict";

var spaciblo = spaciblo || {}
spaciblo.events = spaciblo.events || {}
spaciblo.components = spaciblo.components || {}

spaciblo.events.RendererExitedVR = 'spaciblo-exited-vr'
spaciblo.events.AvatarMotionChanged = 'spaciblo-avatar-motion-changed'
spaciblo.events.TouchMotion = 'spaciblo-touch-motion'
spaciblo.events.EndTouch = 'spaciblo-end-tough'
spaciblo.events.InputActionStarted = 'spaciblo-input-action-started'
spaciblo.events.InputActionEnded = 'spaciblo-input-action-ended'
spaciblo.events.GamepadAdded = 'spaciblo-gamepad-added'
spaciblo.events.GamepadRemoved = 'spaciblo-gamepad-removed'
spaciblo.events.MuteRequested = 'spaciblo-mute-requested'
spaciblo.events.UnmuteRequested = 'spaciblo-unmute-requested'

/*
AccountPageComponent wraps all of the logic for a/index.html
*/
spaciblo.components.AccountPageComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('account-page-component')

		this.topNav = new be.ui.TopNavComponent()
		this.el.appendChild(this.topNav.el)

		this.row = k.el.div({
			class: 'row'
		}).appendTo(this.el)
		this.col = k.el.div({
			class: 'col-12'
		}).appendTo(this.row)

		this.loginComponent = new be.ui.LoginComponent()
		this.loginComponent.addListener(() => {
			let url = new URL(document.location.toString())
			let next = url.searchParams.get('next')
			if(next){
				document.location.href = next
			} else {
				document.location.href = '/'
			}
		}, be.events.LoginSuccessful)
		this.loginComponent.el.style.display = 'none'
		this.col.appendChild(this.loginComponent.el)

		this.logoutButton = k.el.button({ class: 'logout-button' }, 'Logout').appendTo(this.col)
		this.logoutButton.addEventListener('click', this.handleLogoutClick.bind(this))
		this.logoutButton.style.display = 'none'

		this.avatarSelectionComponent = new spaciblo.components.UserAvatarSelectionComponent(be.currentUser)
		this.col.appendChild(this.avatarSelectionComponent.el)

		if(be.currentUser.isNew){
			be.currentUser.addListener(() => {
				this.handleCurrentUser()
			}, 'reset', true)
		} else {
			this.handleCurrentUser()
		}
	}
	handleLogoutClick(ev){
		ev.preventDefault()
		be.api.logout().then(() => {
			this.handleCurrentUser()
		}).catch(err =>{
			console.error('Could not log out', err)
		})
	}
	handleCurrentUser(){
		if(be.currentUser.get('uuid')){
			this.loginComponent.el.style.display = 'none'
			this.logoutButton.style.display = 'block'
			this.avatarSelectionComponent.el.style.display = 'block'
		} else {
			this.loginComponent.el.style.display = 'block'
			this.logoutButton.style.display = 'none'
			this.avatarSelectionComponent.el.style.display = 'none'
		}
	}
}

/*
UserAvatarSelectionComponent allows users to pick their avatar
*/
spaciblo.components.UserAvatarSelectionComponent = class extends k.Component {
	constructor(userDataObject, options={}){
		super(userDataObject, options)
		this.el.addClass('user-avatar-selection-component')

		this.el.appendChild(k.el.h3('Avatar'))

		this.avatar = new be.api.Avatar({ uuid: userDataObject.get('avatarUUID') })
		this.avatarNameEl = k.el.div({ class: 'avatar-name' }).appendTo(this.el)
		this.bindText('name', this.avatarNameEl, null, this.avatar)

		this.changeLink = k.el.a('change').appendTo(this.el)
		this.listenTo('click', this.changeLink, this._showAvatarList)

		this.avatarsList = new be.api.Avatars()
		this.avatarListComponent = new be.ui.CollectionComponent(this.avatarsList, {
			itemComponent: spaciblo.components.AvatarNameItemComponent,
			onClick: (dataObject) => { this._handleItemClick(dataObject) }
		})
		this.el.appendChild(this.avatarListComponent.el)

		this.cancelLink = k.el.a('cancel').appendTo(this.el)
		this.listenTo('click', this.cancelLink, this._hideAvatarList)

		if(userDataObject.get('avatarUUID') !== null){
			this.avatar.fetch()
		}
		this._hideAvatarList()
		this.avatarsList.fetch()
	}
	_handleItemClick(dataObject){
		this.dataObject.set('avatarUUID', dataObject.get('uuid'))
		this.dataObject.save().then((...params) => {
			this.avatar.reset({ uuid: this.dataObject.get('avatarUUID') })
			if(this.dataObject.get('avatarUUID')){
				this.avatar.fetch()
			}
			this._hideAvatarList()
		}).catch((...params) => {
			console.error('Error saving user avatar', ...params)
		})
	}
	_showAvatarList(){
		this.changeLink.style.display = 'none'
		this.avatarListComponent.el.style.display = 'block'
		this.cancelLink.style.display = 'block'
	}
	_hideAvatarList(){
		this.changeLink.style.display = 'block'
		this.avatarListComponent.el.style.display = 'none'
		this.cancelLink.style.display = 'none'
	}
}

spaciblo.components.AvatarNameItemComponent = class extends k.Component {
	constructor(dataObject, options={}){
		super(dataObject, options)
		this.el.addClass('avatar-name-item-component')
		this.avatarNameEl = k.el.div({ class: 'avatar-name' }).appendTo(this.el)
		this.bindText('name', this.avatarNameEl, (name) => {
			if(!name) return 'Unnamed Avatar'
			return name
		})
	}
}

/*
SplashPageComponent wraps all of the logic for index.html
It's main job is to create a canvas and render spaces into it.
*/
spaciblo.components.SplashPageComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('splash-page-component')

		this.topNav = new be.ui.TopNavComponent()
		this.el.appendChild(this.topNav.el)

		this.router = new k.Router()
		this.router.addRoute(/^$/, 'spaces-menu')
		this.router.addRoute(/^([0-9a-z\-]+)$/, 'space')

		this.spacesComponent = new spaciblo.components.SpacesComponent(dataObject)
		this.el.appendChild(this.spacesComponent.el)

		this.spaceMenuComponent = new spaciblo.components.SpaceMenuComponent(dataObject)
		this.el.appendChild(this.spaceMenuComponent.el)

		this.router.addListener(this._handleRoutes.bind(this))
		this.router.start()
	}
	_handleRoutes(routeName, ...params){
		switch(routeName){
			case 'space':
				this.spaceMenuComponent.el.style.display = 'none';
				this.spacesComponent.handleSpaceRoute(params[0])
				break
			default:
				this.spaceMenuComponent.el.style.display = 'block';
				break
		}
	}
	handleAddedToDOM(){
		this.spacesComponent.handleAddedToDOM()
	}
}

/*
SpaceMenuComponent shows a list of spaces (each rendered by SpaceItemComponent) for the user to pick one
*/
spaciblo.components.SpaceMenuComponent = class extends k.Component {
	constructor(dataObject, options={}){
		super(dataObject, options)
		this.el.addClass('space-menu-component')

		this.el.appendChild(k.el.h2('Pick a space'))

		this.spaceList = new be.ui.CollectionComponent(dataObject, {
			itemComponent: spaciblo.components.SpaceItemComponent,
			onClick: this._handleSpaceClick.bind(this)
		})
		this.el.appendChild(this.spaceList.el)
	}
	cleanup(){
		super.cleanup()
		this.spaceList.cleanup()
	}
	_handleSpaceClick(space){
		document.location.href = '#' + space.get('uuid')
	}
}

/*
SpaceItemComponent is used in SpaceMenuComponent to allow choosing a space
*/
spaciblo.components.SpaceItemComponent = class extends k.Component {
	constructor(dataObject, options={}){
		super(dataObject, options)
		this.el.addClass('space-item-component')
		this.el.appendChild(k.el.span(dataObject.get('name')))
	}
}

/*
SpacesComponent manages a spaciblo.three.Renderer that displays spaces
*/
spaciblo.components.SpacesComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('spaces-component')

		this.client = null // Will be a spaciblo.api.Client when a Space is selected
		this.clientUUID = null // An ID for our client that is provided by the WebSocket service

		this.vrDisplay = null // VR display data when we have a VR display available

		this.receivedSpaceUpdate = false // Set to true when the first space update arrives

		// The environment tracks state like whether we're in a headset or have touch events
		this.environment = new spaciblo.input.Environment()
		this.environment.addListener((eventName, env) => {
			this.updateOverlays()
		}, spaciblo.events.EnvironmentChanged)

		// The input manager maps user input from a variety of devices into abstract input events
		this.inputManager = new spaciblo.input.InputManager(this.environment)

		// The worker manager handles the scripts from each Template type that are run in web workers
		this.workerManager = new spaciblo.workers.Manager()
		this.workerManager.addListener((...params) => {
			this.handleWorkerRequestedPORTSChange(...params)
		}, spaciblo.events.WorkerRequestedPORTSChange)

		// The audio manager tracks WebRTC audio streams for each remote user
		this.audioManager = new spaciblo.audio.SpaceManager()
		this.audioManager.addListener(this.handleLocalSDP.bind(this), spaciblo.events.GeneratedSDPLocalDescription)
		this.audioManager.addListener(this.handleLocalICE.bind(this), spaciblo.events.GeneratedICECandidate)
		this.audioManager.addListener(this.handleAudioRemoteUserAdded.bind(this), spaciblo.events.AudioRemoteUserAdded)
		this.audioManager.addListener(this.handleAudioRemoteUserRemoved.bind(this), spaciblo.events.AudioRemoteUserRemoved)

		// The audio control component displays wee level widgets for local and remote audio streams
		this.audioControlComponent = new spaciblo.components.AudioControlComponent(this.audioManager.mainGainNode)
		this.audioControlComponent.el.style.display = 'none'
		this.el.appendChild(this.audioControlComponent.el)
		this.audioControlComponent.addListener(() => {
			this.mainVolumeVisualizer.handleMuted(true)
		}, spaciblo.events.MuteRequested)
		this.audioControlComponent.addListener(() => {
			this.mainVolumeVisualizer.handleMuted(false)
		}, spaciblo.events.UnmuteRequested)

		// Flocks are the set of local apps that you run, separate from the things in the space you're visiting
		this.flocks = new be.api.Flocks()
		this.flocks.fetch().catch(err => { console.error(err) })

		// The lower controls element contain the audio widgets
		this.lowerControlsEl = k.el.div({ class: 'lower-controls' }).appendTo(this.el)
		this.lowerControlsEl.style.display = 'none' // Shown when the space is loaded

		// Local volume level widget
		this.mainVolumeVisualizer = new spaciblo.components.AudioVolumeVisualizer(this.audioManager.mainAnalysisNode)
		this.lowerControlsEl.appendChild(this.mainVolumeVisualizer.el)
		this.listenTo('click', this.mainVolumeVisualizer.el, (event) => {
			if(this.audioControlComponent.el.style.display == 'none'){
				this.audioControlComponent.el.style.display = 'block'
				this.audioControlComponent.start()
			} else {
				this.audioControlComponent.el.style.display = 'none'
				this.audioControlComponent.pause()
			}
		})

		// Local microphone level widget
		this.microphoneVolumeVisualizer = new spaciblo.components.AudioVolumeVisualizer(this.audioManager.microphoneAnalysisNode)
		this.lowerControlsEl.appendChild(this.microphoneVolumeVisualizer.el)
		this.listenTo('click', this.microphoneVolumeVisualizer.el, () => {
			this.audioManager.toggleMicrophoneMute()
			this.microphoneVolumeVisualizer.handleMuted(this.audioManager.microphoneIsMuted)
		})

		// The renderer manages the Three.js scene graph and WebGL canvas
		this.renderer = new spaciblo.three.Renderer(this.inputManager, this.audioManager, this.workerManager, this.flocks)
		this.el.appendChild(this.renderer.el)

		// Toggles the view into WebVR headsets
		this.vrButton = k.el.div({ class:'vr-button' }, 'Enter VR').appendTo(this.el)

		// Allows users on touch screens to drag in order to move around the space
		this.touchMotionComponent = new spaciblo.components.TouchMotionComponent()
		this.el.appendChild(this.touchMotionComponent.el)
		this.touchMotionComponent.addListener(this.handleTouchMotion.bind(this), spaciblo.events.TouchMotion)
		this.touchMotionComponent.addListener(this.handleEndTouch.bind(this), spaciblo.events.EndTouch)

		this.updateSize()

		window.addEventListener('resize', () => { this.updateSize() })
		this.renderer.addListener(this.handleExitedVR.bind(this), spaciblo.events.RendererExitedVR)
		this.inputManager.addListener(this.handleAvatarMotion.bind(this), spaciblo.events.AvatarMotionChanged)
		spaciblo.getVRDisplays().then(this.handleVRDisplays.bind(this))
	}
	cleanup(){
		super.cleanup()
		this.audioManager.cleanup()
		this.mainVolumeVisualizer.cleanup()
		this.microphoneVolumeVisualizer.cleanup()
		this.renderer.cleanup()
		this.touchMotionComponent.cleanup()
	}
	updateOverlays(){
		// Show or hide the motion controller
		if(this.environment.inHeadset){
			this.touchMotionComponent.el.style.display = 'none'
		} else if(this.environment.hasTouch && this.client !== null) {
			this.touchMotionComponent.el.style.display = 'block'
			this.touchMotionComponent.render()
		}

		// Show or hide the enter VR button
		if(this.environment.inHeadset){
			this.vrButton.style.display = 'none'
		} else if(this.environment.hasWebVR && this.client !== null) {
			this.vrButton.style.display = 'inline-block'
		}

		// Show or hide the lower controls, including audio widgets
		if(this.environment.inHeadset){
			this.lowerControlsEl.style.display = 'none'
		} else if(this.client !== null){
			this.lowerControlsEl.style.display = 'block'
		}
	}
	handleAddedToDOM(){
		this.updateSize()
		this.updateOverlays()
		this.mainVolumeVisualizer.start()
		this.microphoneVolumeVisualizer.start()
	}
	handleWorkerRequestedPORTSChange(eventName, data){
		let update = Object.assign({}, data)
		delete update['name']
		this.client.sendUpdatesRequest([update])
	}
	handleLocalSDP(eventName, description, destinationClientUUID){
		this.client.sendRelaySDP(description, destinationClientUUID)
	}
	handleLocalICE(eventName, candidate, destinationClientUUID){
		this.client.sendRelayICE(candidate, destinationClientUUID)
	}
	handleAudioRemoteUserAdded(eventName, remoteUser){
		this.audioControlComponent.addRemoteUser(remoteUser)
	}
	handleAudioRemoteUserRemoved(eventName, remoteUser){
		this.audioControlComponent.removeRemoteUser(remoteUser)
	}
	handleTouchMotion(eventName, deltaX, deltaY){
		this.inputManager.handleTouchMotion(deltaX, deltaY)
	}
	handleEndTouch(){
		this.inputManager.handleTouchEnd()
	}
	handleVRDisplays(displays){
		if(displays.length === 0){
			this.environment.hasWebVR = false
			return
		}
		this.vrDisplay = displays[0] // TODO handle more than one display
		this.vrButton.addEventListener('click', this.handleVRButtonClick.bind(this))
		this.environment.hasWebVR = true
	}
	handleVRButtonClick(ev){
		ev.preventDefault()
		this.enterVR()
	}
	handleExitedVR(renderer){
		this.environment.inHeadset = false
		this.environment.inWebVR = false
		this.updateSize()
	}
	enterVR() {
		if(this.vrDisplay === null){
			console.error("Tried to enter VR with no known VR display")
		} else if (this.vrDisplay.isPresenting) {
 			console.error("Tried to enter VR when already presenting")
		} else {
			this.vrDisplay.requestPresent([{
				source: this.renderer.el
			}]).then(() => {
				this.environment.inWebVR = true
				this.environment.inHeadset = true
				this.renderer.setVRDisplay(this.vrDisplay)
			}).catch(e => {
				this.environment.inWebVR = false
				this.environment.inHeadset = false
				console.error('Unable to init VR', e)
			})
		}
	}
	handleAvatarMotion(eventName, translation, rotation){
		if(this.client === null){
			return
		}
		// Avatar translation is relative to the avatar orientation, so translation of 0,0,-1 is always forward even if the head/camera is pointed elsewhere
		this.client.sendAvatarUpdate(this.renderer.avatarPosition, this.renderer.avatarOrientation, this.renderer.avatarBodyUpdates, translation, rotation)
	}
	handleSpaceRoute(spaceUUID){
		let doIt = () => {
			let space = this.dataObject.firstByField('uuid', spaceUUID)
			if(space === null){
				console.error('No space for UUID', spaceUUID)
				return
			}
			this.showSpace(space)
		}
		if(this.dataObject.isNew){
			this.dataObject.addListener(doIt, 'reset', true)
		} else {
			doIt()
		}
	}
	showSpace(space){
		if(this.client != null){
			console.error("Oops, can't open a second space, yet")
			return
		}
		this.client = new spaciblo.api.Client() 
		this.client.addListener(this.handleClientMessages.bind(this), spaciblo.events.ClientMessageReceived)
		this.client.open().then(() => {
			this.client.joinSpace(space)
			this.updateOverlays()
			this.audioManager.connectToLocalMicrophone().then(stream => {
				this.microphoneVolumeVisualizer.handleConnected(true)
			}).catch((...params) => {
				this.microphoneVolumeVisualizer.handleConnected(false)
			})
		}).catch(err => {
			console.error("Error connecting to the WS service", err)
		})
	}
	handleClientMessages(eventName, message){
		switch(message.type){
			case 'Ack':
				break
			case 'Connected':
				this.clientUUID = message.clientUUID
				this.renderer.setClientUUID(message.clientUUID)
				break
			case 'Space-Update':
				/*
				if(
					(message.additions && message.additions.length > 0) || 
					(message.deletions && message.deletions.length > 0) || 
					(message.nodeUpdates && message.nodeUpdates.length > 0)
				){
					console.log("Space update", message)
				}
				*/
				this.renderer.updateSpace(message.nodeUpdates, message.additions, message.deletions)

				/*
				If this isn't the initial space update then look for avatars as they 
				arrive and leave and attempt to set up audio connections.
				TODO Prevent this from turning into a crippling herd of connections when there are many avatars
				*/
				if(this.receivedSpaceUpdate && message.additions){
					for(let addition of message.additions){
						if(!addition.settings || !addition.settings.clientUUID) continue
						if(this.clientUUID === addition.settings.clientUUID) continue
						this.audioManager.getRemoteUser(addition.settings.clientUUID, true).sendSessionOffer()
					}
				}
				if(this.receivedSpaceUpdate && message.deletions){
					for(let deletion of message.deletions){
						if(!deletion.settings || !deletion.settings.clientUUID) continue
						if(this.clientUUID === deletion.settings.clientUUID) continue
						this.audioManager.removeRemoteUser(deletion.settings.clientUUID)
					}
				}
				this.receivedSpaceUpdate = true
				break
			case 'SDP':
				if(this.clientUUID === message.sourceClientUUID){
					console.error('Received an SDP from myself?!')
					break
				}
				this.audioManager.getRemoteUser(message.sourceClientUUID, true).handleSessionDescription(message.description)
				break
			case 'ICE':
				if(this.clientUUID === message.sourceClientUUID){
					console.error('Received an ICE from myself?!')
					break
				}
				this.audioManager.getRemoteUser(message.sourceClientUUID, true).handleICECandidate(message.candidate)
				break
			default:
				console.error("Unhandled client message", message)
		}
	}
	updateSize(){
		this.renderer.setSize(this.el.offsetWidth, this.el.offsetHeight)
	}
}

/*
AudioControlComponent is shown by the SpacesComponent to allow the user to control audio from remote users
*/
spaciblo.components.AudioControlComponent = class extends k.Component {
	constructor(mainGainNode){
		super()
		this._paused = true
		this._mainGainNode = mainGainNode
		this._oldGainValue = 0
		this.el.addClass('audio-control-component')
		this.el.appendChild(k.el.h2('Audio'))

		this._remoteUserComponents = new Map() // clientUUID -> RemoteUserAudioComponent
		this._remoteUsersEl = k.el.div({ class: 'remote-users' }).appendTo(this.el)

		this._muteToggle = k.el.button({
			class: 'mute-toggle',
			type: 'button'
		}, 'Mute all').appendTo(this.el)
		this.listenTo('click', this._muteToggle, (event) => {
			if(this._mainGainNode.gain.value === 0){
				this._mainGainNode.gain.value = 1
				this._muteToggle.innerText = 'Mute all'
				this.trigger(spaciblo.events.UnmuteRequested)
			} else {
				this._oldGainValue = this._mainGainNode.gain.value
				this._mainGainNode.gain.value = 0
				this._muteToggle.innerText = 'Unmute all'
				this.trigger(spaciblo.events.MuteRequested)
			}
		})
	}
	cleanup(){
		super.cleanup()
		for(let [index, remoteUserAudioComponent] of this._remoteUserComponents){
			remoteUserAudioComponent.cleanup()
		}
		this._remoteUserComponents.clear()
	}
	get paused(){ return this._paused }
	set paused(value){
		if(value === this._paused) return
		this._paused = value
		for(let [index, remoteUserAudioComponent] of this._remoteUserComponents){
			remoteUserAudioComponent.paused = this._paused
		}
	}
	start(){ this.paused = false }
	pause(){ this.paused = true }
	addRemoteUser(remoteUser){
		// RemoteUser is from spaciblo.audio
		if(this._remoteUserComponents.has(remoteUser.clientUUID)) return
		const component = new spaciblo.components.RemoteUserAudioComponent(remoteUser)
		this._remoteUsersEl.appendChild(component.el)
		this._remoteUserComponents.set(remoteUser.clientUUID, component)
		if(this.paused === false){
			component.start()
		}
	}
	removeRemoteUser(remoteUser){
		const component = this._remoteUserComponents.get(remoteUser.clientUUID)
		if(typeof component === 'undefined') return
		this._remoteUserComponents.delete(remoteUser.clientUUID)
		component.el.remove()
		component.cleanup()
	}
}

/*
RemoteUserAudioComponent is shown in the AudioControlComponent for each spaciblo.audio.RemoteUser
*/
spaciblo.components.RemoteUserAudioComponent = class extends k.Component {
	constructor(remoteUser){
		super()
		this.el.addClass('remote-user-audio-component')
		this._remoteUser = remoteUser
		this._volumeComponent = new spaciblo.components.AudioVolumeVisualizer(this._remoteUser.analysisNode)
		this.listenTo('click', this._volumeComponent.el, ()=> {
			this._remoteUser.toggleMuted()
			this._volumeComponent.handleMuted(this._remoteUser.isMuted)
		})
		this.el.appendChild(this._volumeComponent.el)
	}
	get paused(){ return this._volumeComponent.paused }
	set paused(value){ this._volumeComponent.paused = value }
	start(){ this.paused = false }
	pause(){ this.paused = true }
	cleanup(){
		super.cleanup()
		this._volumeComponent.cleanup()
	}
}

/*
AudioVisualizer is the base class for k.Components that render some visualization to canvas for a WebAudio AnalysisNode
It takes care of getting audio data into this.dataArray, requesting animation frames, etc.
Extending classes override draw() with their specific canvas manipulation code.
*/
spaciblo.components.AudioVisualizer = class extends k.Component {
	constructor(analysisNode, frequencyInsteadOfByte=false, fftSize=2048){
		super()
		this.el.addClass('audio-visualizer')
		this._paused = true
		this._boundDraw = this._draw.bind(this)
		this._analysisNode = analysisNode
		this._analysisNode.fftSize = fftSize
		this._frequencyInsteadOfByte = frequencyInsteadOfByte
		this.bufferLength = this._analysisNode.frequencyBinCount
		this.dataArray = new Uint8Array(this.bufferLength)
		if(this._frequencyInsteadOfByte){
			this._analysisNode.getByteFrequencyData(this.dataArray)
		} else {
			this._analysisNode.getByteTimeDomainData(this.dataArray)
		}
		this.canvas = k.el.canvas().appendTo(this.el)
		this.canvasContext = this.canvas.getContext('2d')
	}
	cleanup(){
		super.cleanup()
		this._paused = true
	}
	get paused(){ return this._paused }
	set paused(value){
		if(value === this._paused) return
		this._paused = value
		if(this._paused === false){
			this._boundDraw()
		}
	}
	start(){ this.paused = false }
	pause(){ this.paused = true }
	draw(){
		// Extending clients override this with their specific canvas drawing code
		throw 'Not implemented'
	}
	_draw(){
		if(this._paused) return
		requestAnimationFrame(this._boundDraw)
		if(this._frequencyInsteadOfByte){
			this._analysisNode.getByteFrequencyData(this.dataArray)
		} else {
			this._analysisNode.getByteTimeDomainData(this.dataArray)
		}
		this.draw()
	}
}

spaciblo.components.AudioVolumeVisualizer = class extends spaciblo.components.AudioVisualizer {
	constructor(analysisNode){
		super(analysisNode, true, 256)
		this.el.addClass('audio-volume-visualizer')
		this._warnValue = 0.8 // Above this value the bar turns a warning color
		this._isConnected = true
		this._isMuted = false

		this._disconnectedEl = k.el.span({ class: 'icon disconnected' }, 'X').appendTo(this.el)
		this._mutedEl = k.el.span({ class: 'icon muted' }, 'X').appendTo(this.el)

		this._updateEls()
	}
	handleConnected(connected){
		this._isConnected = connected
		this._isMuted = false
		this._updateEls()
	}
	toggleMuted(){
		this.handleMuted(this._isMuted === false)
	}
	handleMuted(mute){
		this._isMuted = mute
		this._updateEls()
	}
	_updateEls(){
		if(this._isConnected){
			this._disconnectedEl.style.display = 'none'
			if(this._isMuted){
				this._mutedEl.style.display = 'inline-block'
			} else {
				this._mutedEl.style.display = 'none'
			}
		} else {
			this._disconnectedEl.style.display = 'inline-block'
			this._mutedEl.style.display = 'none'
		}
	}
	draw(){
		this.canvasContext.fillStyle = 'rgb(256, 256, 256)'
		this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height)

		let sum = 0
		for (var i = 0; i < this.bufferLength; i++) {
			sum += this.dataArray[i] / 128.0
		}
		const average = sum / this.bufferLength // Value in range [0,1]
		const barHeight = this.canvas.height * average
		if(average > this._warnValue){
			this.canvasContext.fillStyle = 'rgb(256, 0, 0)'
		} else {
			this.canvasContext.fillStyle = 'rgb(100, 100, 100)'
		}
		this.canvasContext.fillRect(0, this.canvas.height - barHeight, this.canvas.width, this.canvas.height)
	}
}


/*
AudioVisualizer shows a wave form for an WebAudio AnalyserNode
*/
spaciblo.components.AudioWaveVisualizer = class extends spaciblo.components.AudioVisualizer {
	constructor(analysisNode){
		super(analysisNode)
		this.el.addClass('audio-wave-vizualizer')
	}
	draw(){
		this.canvasContext.fillStyle = 'rgb(200, 200, 200)'
		this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height)

		this.canvasContext.lineWidth = 2
		this.canvasContext.strokeStyle = 'rgb(0, 0, 0)'

		this.canvasContext.beginPath()

		var sliceWidth = this.canvas.width * 1.0 / this.bufferLength
		var x = 0
		for (var i = 0; i < this.bufferLength; i++) {
			var v = this.dataArray[i] / 128.0
			var y = v * this.canvas.height / 2
			if (i === 0) {
				this.canvasContext.moveTo(x, y)
			} else {
				this.canvasContext.lineTo(x, y)
			}
			x += sliceWidth
		}
		this.canvasContext.lineTo(this.canvas.width, this.canvas.height / 2)
		this.canvasContext.stroke()
	}
}

/*
Shows a touchable UI for dragging to translate around the space
*/
spaciblo.components.TouchMotionComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('touch-motion-component')
		this.canvas = k.el.canvas().appendTo(this.el)
		this.context = this.canvas.getContext('2d')
		this.render()

		this.dragDistance = 100 // The distance from drag start that is full motion speed
		this.startX = -1
		this.startY = -1

		this.el.addEventListener("touchstart", ev => { this.handleTouchStart(ev) }, false)
		this.el.addEventListener("touchmove", ev => { this.handleTouchMove(ev) }, false)
		this.el.addEventListener("touchend", ev => { this.handleTouchEnd(ev) }, false)
		this.el.addEventListener("touchcancel", ev => { this.handleTouchEnd(ev) }, false)
	}
	handleTouchStart(ev) {
		ev.preventDefault()
		this.startX = ev.changedTouches[0].pageX
		this.startY = ev.changedTouches[0].pageY
	}
	handleTouchMove(ev){
		ev.preventDefault()
		let deltaX = ev.changedTouches[0].pageX - this.startX
		if(deltaX > 100) deltaX = 100
		if(deltaX < -100) deltaX = -100
		let deltaY = ev.changedTouches[0].pageY - this.startY
		if(deltaY > 100) deltaY = 100
		if(deltaY < -100) deltaY = -100
		this.trigger(spaciblo.events.TouchMotion, deltaX / 100, deltaY / 100)
	}
	handleTouchEnd(ev) {
		ev.preventDefault()
		this.trigger(spaciblo.events.EndTouch)
	}
	render(){
		if(this.el.offsetWidth){
			this.canvas.width = this.el.offsetWidth
			this.canvas.height = this.el.offsetHeight
		}

		const width = this.canvas.width
		const height = this.canvas.height

		// Underlying shape constants
		const inset = 2
		const cornerRadius = 5
		const topWidth = width * 0.4
		const topLeft = (width / 2) - (topWidth / 2)
		const topRight = (width / 2) + (topWidth / 2)
		const bottomHeight = height / 2

		// Arrow constants
		const arrowInset = 10
		const arrowWidth = 15
		const arrowHeadWidth = 30
		const arrowHeadDepth = 15

		this.context.clearRect(0, 0, width, height)

		// Draw underlying shape
		this.context.beginPath()
		this.context.moveTo(topLeft + cornerRadius, inset)					// Top left horizontal line start
		this.context.lineTo(topRight - cornerRadius, inset)					// Top right horizontal line end
		this.context.lineTo(topRight, inset + cornerRadius) 				// Corner
		this.context.lineTo(topRight, bottomHeight - cornerRadius)			// Middle right vertical line end
		this.context.lineTo(topRight + cornerRadius, bottomHeight)			// Corner
		this.context.lineTo(width - inset - cornerRadius, bottomHeight)		// Middle right horizontal line end
		this.context.lineTo(width - inset, bottomHeight + cornerRadius)		// Corner
		this.context.lineTo(width - inset, height - inset - cornerRadius)	// Bottom right vertical line end
		this.context.lineTo(width - inset - cornerRadius, height - inset)	// Corner
		this.context.lineTo(inset + cornerRadius, height - inset)			// Bottom left horizontal line end
		this.context.lineTo(inset, height - inset - cornerRadius)			// Corner
		this.context.lineTo(inset, bottomHeight + cornerRadius)				// Middle left vertical line end
		this.context.lineTo(inset + cornerRadius, bottomHeight)				// Corner
		this.context.lineTo(topLeft - cornerRadius, bottomHeight)			// Middle left horizontal line end
		this.context.lineTo(topLeft, bottomHeight - cornerRadius)			// Corner
		this.context.lineTo(topLeft, inset + cornerRadius)					// Top left vertical line end
		this.context.closePath()
		this.context.fillStyle = '#DDDDDD'
		this.context.fill()

		// Draw triple headed arrow
		this.context.beginPath()
		this.context.moveTo(width / 2 - arrowWidth / 2, bottomHeight + bottomHeight / 2 - arrowWidth / 2)
		this.context.lineTo(width / 2 - arrowWidth / 2, arrowInset + arrowHeadDepth)
		this.context.lineTo(width / 2 - arrowHeadWidth / 2, arrowInset + arrowHeadDepth)
		this.context.lineTo(width / 2, arrowInset) // top peak
		this.context.lineTo(width / 2 + arrowHeadWidth / 2, arrowInset + arrowHeadDepth)
		this.context.lineTo(width / 2 + arrowWidth / 2, arrowInset + arrowHeadDepth)
		this.context.lineTo(width / 2 + arrowWidth / 2, bottomHeight + bottomHeight / 2 - arrowWidth / 2) // right middle corner
		this.context.lineTo(width - arrowInset - arrowHeadDepth, bottomHeight + bottomHeight / 2 - arrowWidth / 2)
		this.context.lineTo(width - arrowInset - arrowHeadDepth, bottomHeight + bottomHeight / 2 - arrowHeadWidth / 2)
		this.context.lineTo(width - arrowInset, bottomHeight + bottomHeight / 2)
		this.context.lineTo(width - arrowInset - arrowHeadDepth, bottomHeight + bottomHeight / 2 + arrowHeadWidth / 2)
		this.context.lineTo(width - arrowInset - arrowHeadDepth, bottomHeight + bottomHeight / 2 + arrowWidth / 2)
		this.context.lineTo(arrowInset + arrowHeadDepth, bottomHeight + bottomHeight / 2 + arrowWidth / 2)
		this.context.lineTo(arrowInset + arrowHeadDepth, bottomHeight + bottomHeight / 2 + arrowHeadWidth / 2)
		this.context.lineTo(arrowInset, bottomHeight + bottomHeight / 2) // Right peak
		this.context.lineTo(arrowInset + arrowHeadDepth, bottomHeight + bottomHeight / 2 - arrowHeadWidth / 2)
		this.context.lineTo(arrowInset + arrowHeadDepth, bottomHeight + bottomHeight / 2 - arrowWidth / 2)

		this.context.closePath()
		this.context.lineWidth = 2
		this.context.strokeStyle = '#FFF'
		this.context.stroke()

	}
}

/*
Returns a promise that returns an array of WebVR displays
*/
spaciblo.getVRDisplays = function(){
	return new Promise((resolve, reject) => {
		if(spaciblo.hasWebVR() === false){
			resolve([])
			return
		}
		navigator.getVRDisplays().then(displays => {
			displays = displays.filter(display => display.capabilities.canPresent)
			resolve(displays)
			return
		})
	})
}

/*
Returns true if the browser has the WebVR APIs, regardless of whether a VR rig is attached
*/
spaciblo.hasWebVR = function(){
	return typeof VRFrameData === 'function'
}