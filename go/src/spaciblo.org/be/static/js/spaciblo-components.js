"use strict"

var spaciblo = spaciblo || {}
spaciblo.events = spaciblo.events || {}
spaciblo.components = spaciblo.components || {}

spaciblo.events.SpaceSelected = 'spaciblo-space-selected'
spaciblo.events.AvatarMotionChanged = 'spaciblo-avatar-motion-changed'

/*
SplashPageComponent wraps all of the logic for index.html
It's main job is to create a canvas and render spaces into it.
*/
spaciblo.components.SplashPageComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('splash-page-component')

		this.spacesComponent = new spaciblo.components.SpacesComponent(dataObject)
		this.el.appendChild(this.spacesComponent.el)
	}
	handleAddedToDOM(){
		this.spacesComponent.updateSize()
	}
}

/*
SpacesComponent manages a spaciblo.three.Renderer that displays spaces
*/
spaciblo.components.SpacesComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('spaces-component')
		this.inputManager = new spaciblo.components.InputManager()
		this.client = null // Will be a spaciblo.api.Client when a Space is selected
		this.vrDisplay = null

		this.renderer = new spaciblo.three.Renderer(this.inputManager)
		this.el.appendChild(this.renderer.el)

		this.dataObject.addListener(this.handleReset.bind(this), "reset")
		if(this.dataObject.length > 0){
			this.handleReset()
		}

		this.vrButton = k.el.div({ class:'vr-button' }, 'Enter VR').appendTo(this.el)

		this.updateSize()
		window.addEventListener('resize', () => { this.updateSize() })
		this.renderer.addListener(this.handleSpaceSelected.bind(this), spaciblo.events.SpaceSelected)
		this.inputManager.addListener(this.handleAvatarMotion.bind(this), spaciblo.events.AvatarMotionChanged)

		spaciblo.getVRDisplays().then(this.handleVRDisplays.bind(this))
	}
	handleVRDisplays(displays){
		if(displays.length === 0){
			return
		}
		this.vrDisplay = displays[0] // TODO handle more than one display
		this.vrButton.style.display = 'inline-block'
		this.vrButton.addEventListener('click', this.handleVRButtonClick.bind(this))
	}
	handleVRButtonClick(ev){
		ev.preventDefault()
		this.toggleVR()
	}
	toggleVR() {
 		if (this.vrDisplay.isPresenting) {
			 this.vrDisplay.exitPresent()
		} else {
			this.vrDisplay.requestPresent([{
				source: this.renderer.el
			}]).then(() => {
				this.renderer.setVRDisplay(this.vrDisplay)
			}).catch(e => {
				console.error(`Unable to init VR: ${e}`);
			})
		}
	}
	handleAvatarMotion(eventName, translation, rotation){
		if(this.client === null){
			return
		}
		// Avatar translation is relative to the avatar's local orientation, so translation of 0,0,-1 is always forward for the avatar
		this.client.sendAvatarUpdate(this.renderer.avatarPosition, this.renderer.avatarOrientation, translation, rotation)
	}
	handleSpaceSelected(eventName, space){
		if(this.client != null){
			console.error("Oops, can't open a second space, yet")
			return
		}
		this.client = new spaciblo.api.Client() 
		this.client.addListener(this.handleClientMessages.bind(this), spaciblo.events.ClientMessageReceived)
		this.client.open().then(() => {
			this.client.joinSpace(space)
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
				break
			default:
				console.log("Unhandled client message", message)
		}
	}
	handleReset(){
		this.renderer.clearSpacesMenu()
		for(let space of this.dataObject){
			this.renderer.addSpaceToMenu(space, false)
		}
		this.renderer.layoutSpaceMenu()
	}
	updateSize(){
		this.renderer.setSize(this.el.offsetWidth, this.el.offsetHeight)
	}
}

spaciblo.components.KeyMap = new Map()
spaciblo.components.KeyMap.set("left-arrow", 37)
spaciblo.components.KeyMap.set("up-arrow", 38)
spaciblo.components.KeyMap.set("right-arrow", 39)
spaciblo.components.KeyMap.set("down-arrow", 40)
spaciblo.components.KeyMap.set("q", 81)
spaciblo.components.KeyMap.set("e", 69)

spaciblo.components.InputManager = k.eventMixin(class {
	constructor(){
		this._keysDown = new Set()

		this.keyboardRotationDelta = 1.2 // Radians per second
		this.keyboardTranslationDelta = 1.9 // Meters per second

		this._gamepads = {} // Gamepad.index -> Gamepad object

		// When the user input indicates they want to rotate or translate, these are non zero
		this._inputRotation =    [0,0,0]
		this._inputTranslation = [0,0,0] // xyz translation in camera direction

		// When the user input indicates that they want to teleport to a new position and orientation, teleportPosition is non-zero
		this._teleportPosition =    [0,0,0]
		this._teleportOrientation = [0,0,0,1]

		document.onkeydown = ev => { this._handleKeyDown(ev) }
		document.onkeyup   = ev => { this._handleKeyUp(ev)   }
		window.addEventListener('gamepadconnected', ev => { this.handleGamepadConnected(ev) })
		window.addEventListener('gamepaddisconnected', ev => { this.handleGamepadDisconnected(ev) })
	}

	// Gamepad input methods	
	handleGamepadConnected(ev){
		console.log('Gamepad connected', ev.gamepad.id, ev.gamepad.index, ev.gamepad)
		this._gamepads[ev.gamepad.index] = ev.gamepad
	}
	handleGamepadDisconnected(ev){
		console.log('Gamepad disconnected', ev.gamepad.id, ev.gamepad.index, ev.gamepad)
		delete this._gamepads[ev.gamepad.index]
	}

	// Keyboard input methods
	_handleKeyDown(ev){
		if(this.isDown(ev.keyCode)) return
		this._keysDown.add(ev.keyCode)
		if(this._updateVectors()){
			this._sendAvatarUpdate()
		}
	}
	_handleKeyUp(ev){
		if(this.isDown(ev.keyCode) == false) return
		this._keysDown.delete(ev.keyCode)
		if(this._updateVectors()){
			this._sendAvatarUpdate()
		}
	}

	isDown(keyCode){
		return this._keysDown.has(keyCode)
	}

	// Returns true if the rotation or translation changed
	_updateVectors(){
		let oldRotation = [...this.inputRotation]
		let oldTranslation = [...this.inputTranslation]
		if(this.isDown(spaciblo.components.KeyMap.get('left-arrow')) && this.isDown(spaciblo.components.KeyMap.get('right-arrow')) == false){
			this._inputRotation[0] = 0
			this._inputRotation[1] = this.keyboardRotationDelta
			this._inputRotation[2] = 0
		} else if(this.isDown(spaciblo.components.KeyMap.get('right-arrow')) && this.isDown(spaciblo.components.KeyMap.get('left-arrow')) == false){
			this._inputRotation[0] = 0
			this._inputRotation[1] = -1 * this.keyboardRotationDelta
			this._inputRotation[2] = 0
		} else {
			this._inputRotation[0] = 0
			this._inputRotation[1] = 0
			this._inputRotation[2] = 0
		}
		if(this.isDown(spaciblo.components.KeyMap.get('up-arrow')) && (this.isDown(spaciblo.components.KeyMap.get('down-arrow')) == false)) {
			this._inputTranslation[0] = 0
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = -1 * this.keyboardTranslationDelta
		} else if(this.isDown(spaciblo.components.KeyMap.get('down-arrow')) && (this.isDown(spaciblo.components.KeyMap.get('up-arrow')) == false)) {
			this._inputTranslation[0] = 0
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = this.keyboardTranslationDelta
		} else if(this.isDown(spaciblo.components.KeyMap.get('q')) && (this.isDown(spaciblo.components.KeyMap.get('e')) == false)) {
			this._inputTranslation[0] = this.keyboardTranslationDelta
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = 0
		} else if(this.isDown(spaciblo.components.KeyMap.get('e')) && (this.isDown(spaciblo.components.KeyMap.get('q')) == false)) {
			this._inputTranslation[0] = -1 * this.keyboardTranslationDelta
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = 0
		} else {
			this._inputTranslation[0] = 0
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = 0
		}
		// Return true if anything changed
		if(oldRotation.every((val, index) => { return val === this._inputRotation[index] }) === false) {
			return true
		}
		if(oldTranslation.every((val, index) => { return val === this._inputTranslation[index] }) === false) {
			return true
		}
		return false
	}

	_sendAvatarUpdate() {
		this.trigger(spaciblo.events.AvatarMotionChanged, this._inputTranslation, this._inputRotation)
	}

	// Query methods called by the renderer during frame rendering
	get inputTranslation() { return this._inputTranslation }
	get inputRotation() { return this._inputRotation }
})

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

spaciblo.hasWebVR = function(){
	return typeof VRFrameData === 'function'
}