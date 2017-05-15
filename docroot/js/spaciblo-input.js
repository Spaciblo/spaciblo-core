'use strict'

/*
Input related code that handles user events from the keyboard, gamepad, etc
*/

var spaciblo = spaciblo || {}
spaciblo.input = spaciblo.input || {}
spaciblo.events = spaciblo.events || {}

spaciblo.events.EnvironmentChanged = 'spaciblo-environment-changed'

// Gamepad IDs for various types of gamepads
spaciblo.input.GAMEPAD_6DOF_IDS = [
	'Oculus Touch (Left)',
	'Oculus Touch (Right)',
	'OpenVR Gamepad'
]
spaciblo.input.GAMEPAD_3DOF_IDS = [
	'Daydream Controller'
]

/*
Environment exposes what we know about the hardware and current state of the browser as it relates to VR
Do we have touch events? Do we have orientation events? Are we currently presenting in an HMD?
This information is used by the input manager to determine what schema should be active.
This information is also used by the SpacesComponent to show or hide the appropriate overlay widgets.
*/
spaciblo.input.Environment = k.eventMixin(class {
	constructor(){
		this._hasWebVR = false
		this._inWebVR = false
		this._inCardboard = false
		this._inHeadset = false
		this._hasTouch = false
		this._hasOrientation = false
		this._gamepadCount = 0
		this._6dofControllerCount = 0
		this._3dofControllerCount = 0

		// Listen for the first orientation event and set _hasOrientation if it arrives
		let orientationFunc = ev => {
			window.removeEventListener('deviceorientation', orientationFunc)
			this._hasOrientation = true
			this.trigger(spaciblo.events.EnvironmentChanged, this)
		}
		window.addEventListener('deviceorientation', orientationFunc, false)

		// Listen for the first touch event and set _hasTouch if it arrives
		let touchFunc = ev => {
			window.removeEventListener('touchstart', touchFunc)
			this._hasTouch = true
			this.trigger(spaciblo.events.EnvironmentChanged, this)
		}
		window.addEventListener('touchstart', touchFunc, false)

		// Track available gamepad types
		window.addEventListener('gamepadconnected', this.updateGamepadInfo.bind(this))
		window.addEventListener('gamepaddisconnected', this.updateGamepadInfo.bind(this))
	}

	updateGamepadInfo(){
		/*
		Updates some general information about what gamepads are connected.
		Triggers an EnvironmentChanged event if there is a change.
		This is called when gamepads are connected or disconnected and at the top of every frame render.
		*/
		let gamepadCount = 0
		let sixDOFControllerCount = 0
		let threeDOFControllerCount = 0
		for(let gamepad of navigator.getGamepads()){
			if(gamepad === null) continue
			gamepadCount += 1
			if(typeof gamepad.pose === 'undefined' || gamepad.pose === null) continue
			if(gamepad.pose.hasOrientation && gamepad.pose.hasPosition){
				sixDOFControllerCount += 1
			} else if(gamepad.pose.hasOrientation){
				threeDOFControllerCount += 1
			}
		}
		if(gamepadCount === this._gamepadCount && sixDOFControllerCount === this._6dofControllerCount && threeDOFControllerCount === this._3dofControllerCount){
			// No change
			return
		}
		this._gamepadCount = gamepadCount
		this._6dofControllerCount = sixDOFControllerCount
		this._3dofControllerCount = threeDOFControllerCount
		this.trigger(spaciblo.events.EnvironmentChanged, this)
	}

	// True if any sort of gamepad is connected
	get hasGamepads(){ return this._gamepadCount > 0 }

	// Returns the number of gamepads that are connected
	get gamepadCount(){ return this._gamepadCount }

	// True if a gamepad with only orientation (not position) tracking is connected
	get has3DOFControllers(){ return this._3dofControllerCount > 0 }
	get threeDOFControllerCount(){ return this._3dofControllerCount }

	// True if a gamepad with both orientation and position tracking is connected
	get has6DOFControllers(){ return this._has6DOFControllers }
	get sixDOFControllerCount(){ return this._6dofControllerCount }

	// The number of controllers connected that are neither 6dof nor 3dof tracked controllers
	get untrackedControllerCount(){ return this._gamepadCount - this._6dofControllerCount - this._3dofControllerCount }

	// True if there is a WebVR display available (whether presenting or not)
	get hasWebVR(){ return this._hasWebVR }
	set hasWebVR(val){
		if(val === this._hasWebVR) return
		this._hasWebVR = val
		this.trigger(spaciblo.events.EnvironmentChanged, this)
	}

	// True if currently presenting in a WebVR display
	get inWebVR(){ return this._inWebVR }
	set inWebVR(val){
		if(val === this._inWebVR) return
		this._inWebVR = val
		this.trigger(spaciblo.events.EnvironmentChanged, this)
	}

	// True if the device is able to run cardboard
	get hasCardboard(){
		return this.hasTouch && this.hasOrientation && this.isMobile
	}

	// True if presenting in Cardboard
	get inCardboard(){ return this._inCardboard }
	set inCardboard(val){
		if(val === this._inCardboard) return
		this._inCardboard = val
		this.trigger(spaciblo.events.EnvironmentChanged, this)
	}

	// True if presenting Cardboard or a WebVR display
	get inHeadset(){ return this._inHeadset }
	set inHeadset(val){
		if(val === this._inHeadset) return
		this._inHeadset = val
		this.trigger(spaciblo.events.EnvironmentChanged, this)
	}

	// True as soon as we receive at least one touch screen event
	get hasTouch(){ return this._hasTouch }

	// True as soon as we receive at least one orientation event
	get hasOrientation(){ return this._hasOrientation }

	// True if the browser is recognized as a mobile browser
	get isMobile(){ return be.isMobile.any() }
})

// Some combination of keyboard (not gamepad) keys (e.g. shift + control + z)
spaciblo.input.KeyChord = class {
	constructor(keyCode, shift=false, control=false, alt=false, meta=false, action=null){
		this.keyCode = keyCode
		this.shift = shift
		this.control = control
		this.alt = alt
		this.meta = meta
		this.action = action // null or a spaciblo.input.InputAction
	}
	isModifier(){
		return spaciblo.input.MODIFIER_KEYCODES.indexOf(this.keyCode) != -1
	}
	setFromEvent(ev){
		this.keyCode = ev.keyCode
		this.shift = ev.shiftKey
		this.control = ev.ctrlKey
		this.alt = ev.altKey
		this.meta = ev.metaKey
	}
	chordEqual(obj){
		if(typeof obj !== 'object') return false
		if(obj instanceof spaciblo.input.KeyChord === false) return false
		if(obj.keyCode !== this.keyCode) return false
		if(obj.shift !== this.shift) return false
		if(obj.control !== this.control) return false
		if(obj.alt !== this.alt) return false
		return true
	}
}

spaciblo.input.XBOX_ONE_CONTROLLER_ID_REGEX = /xinput/
spaciblo.input.DAYDREAM_CONTROLLER_ID_REGEX = /Daydream Controller/
spaciblo.input.OPENVR_CONTROLLER_ID_REGEX = /OpenVR Gamepad/
spaciblo.input.OCULUS_TOUCH_CONTROLLER_ID_REGEX = /Oculus Touch \((Left|Right)\)/
spaciblo.input.OCULUS_REMOTE_ID_REGEX = /Oculus Remote/

spaciblo.input.CONTROLLER_ID_REGEXES = [
	spaciblo.input.XBOX_ONE_CONTROLLER_ID_REGEX,
	spaciblo.input.DAYDREAM_CONTROLLER_ID_REGEX,
	spaciblo.input.OPENVR_CONTROLLER_ID_REGEX,
	spaciblo.input.OCULUS_TOUCH_CONTROLLER_ID_REGEX,
	spaciblo.input.OCULUS_REMOTE_ID_REGEX
]

spaciblo.input.UNKNOWN_CONTROLLER_ID_REGEX = /unknown/

// Some combination of gamepad (XBox controller, Oculus Touch, Vive controller...) input
spaciblo.input.ControllerChord = class {
	constructor(idRegex=null, hand=null, buttons=null, axes=null, action=null){
		this.idRegex = idRegex || spaciblo.input.UNKNOWN_CONTROLLER_ID_REGEX
		this.hand = hand
		this.buttons = buttons
		this.axes = axes
		this.action = action
	}
	chordEqual(obj){
		if(this._typeIsEqual(this, obj) === false) return false
		if(this.idRegex !== obj.idRegex) return false
		if(this.hand !== obj.hand) return false
		// Either party can indicate with a null that they don't care
		if(this.buttons !== null && obj.buttons !== null){
			if(this.buttons.length !== obj.buttons.length) return false
			for(let i=0; i < this.buttons.length; i++){
				// Either party can indicate with a null that they don't care
				if(this.buttons[i].pressed !== null && obj.buttons[i].pressed !== null){
					if(this.buttons[i].pressed !== obj.buttons[i].pressed) return false
				}
				// Either party can indicate with a null that they don't care
				if(this.buttons[i].touched !== null && obj.buttons[i].touch !== null){
					if(this.buttons[i].touched !== obj.buttons[i].touched) return false
				}
				// Either party can indicate with a null that they don't care
				// value can also be a function so that it can match a range
				if(this.buttons[i].value !== null && obj.buttons[i].value !== null){
					if(typeof this.buttons[i].value === 'function'){
						if(this.buttons[i].value(obj.buttons[i].value) === false) return false
					} else if(typeof obj.buttons[i].value === 'function'){
						if(obj.buttons[i].value(this.buttons[i].value) === false) return false
					} else {
						if(this.buttons[i].value !== obj.buttons[i].value) return false
					}
				}
			}
		}

		// Either party can indicate with a null that they don't care
		if(this.axes !== null && obj.axes !== null){
			if(this.axes.length !== obj.axes.length) return false
			for(let i=0; i < this.axes.length; i++){
				if(this.axes[i] === null || obj.axes[i] === null) continue
				if(typeof this.axes[i] === 'function'){
					if(this.axes[i](obj.axes[i]) === false) return false
				} else if(typeof obj.axes[i] === 'function'){
					if(obj.axes[i](this.axes[i]) === false) return false
				} else {
					if(this.axes[i] !== obj.axes[i]) return false
				}
			}
		}
		return true
	}
	setFromGamepad(gamepad){
		this.hand = gamepad.hand || ""
		this.buttons = gamepad.buttons.map(button => {
			return {
				pressed: button.pressed,
				touched: button.touched,
				value: button.pressed ? button.value : 0
			}
		})
		this.axes = [...gamepad.axes]
		this.idRegex = spaciblo.input.CONTROLLER_ID_REGEXES.find(reg => {
			return gamepad.id.match(reg) !== null
		}) || spaciblo.input.UNKNOWN_CONTROLLER_ID_REGEX
	}
	_typeIsEqual(obj1, obj2){
		if(typeof obj1 !== typeof obj2) return false
		if(obj1 === null && obj2 !== null) return false
		if(obj2 === null && obj1 !== null) return false
		return true
	}
}

// A high level user action, like 'translate-forward', 'point', or 'grip' used by InputSchema
spaciblo.input.InputAction = class {
	constructor(name){
		this.name = name
	}
}

// Maps KeyChords and ControllerChords to Actions (eventually other action types)
spaciblo.input.InputSchema = class {
	constructor(){
		this.keyChords = new Set()
		this.controllerChords = new Set()
		this.actions = new Map() // name to InputAction
	}
	addAction(action){
		this.actions[action.name] = action
	}
	getAction(name){
		return this.actions[name]
	}
	addKeyChord(keyChord){
		if(keyChord.action === null){
			console.error('Cannot add a KeyChord with a null action', keyChord)
			return
		}
		this.keyChords.add(keyChord)
	}
	getKeyChordAction(keyChord){
		for(let chord of this.keyChords){
			if(chord.chordEqual(keyChord)){
				return chord.action
			}
		}
		return null
	}
	addControllerChord(controllerChord){
		if(controllerChord.action === null){
			console.error('Cannot add a ControllerChord with a null action', controllerChord)
			return
		}
		this.controllerChords.add(controllerChord)
	}
	getControllerChordAction(controllerChord){
		for(let chord of this.controllerChords){
			if(chord.chordEqual(controllerChord)){
				return chord.action
			}
		}
		return null
	}
}

// Set up a default input schema.
spaciblo.input.DefaultInputSchema = new spaciblo.input.InputSchema()
spaciblo.input._defaultActions = [
	'translate-forward',
	'translate-backward',
	'translate-left',
	'translate-right',
	'translate-up',
	'translate-down',
	'rotate-left',
	'rotate-right',
	'left-point',
	'right-point',
	'teleport',
	'toggle-flock',
	'left-point',
	'right-point'
]
spaciblo.input._defaultActions.forEach((name, index) => {
	spaciblo.input.DefaultInputSchema.addAction(new spaciblo.input.InputAction(name))
})

// TODO figure out a nicer way to encapsulate the chords for each type of controller (vive, daydream, etc) and each mode (flat, cardboard, WebVR)
spaciblo.input._generateOculusTouchChord = function(hand, buttons=true, axes=false, action=null){
	return new spaciblo.input.ControllerChord(
		spaciblo.input.OCULUS_TOUCH_CONTROLLER_ID_REGEX,
		hand,
		buttons ? [
			{ pressed: false, touched: null, value: null },
			{ pressed: false, touched: null, value: null },
			{ pressed: false, touched: null, value: null },
			{ pressed: false, touched: null, value: null },
			{ pressed: false, touched: null, value: null },
			{ pressed: false, touched: null, value: null }
		] : null,
		axes ? [
			null,
			null
		] : null,
		action
	)
}

var _tempChord = spaciblo.input._generateOculusTouchChord('left', true, true, spaciblo.input.DefaultInputSchema.getAction('translate-forward'))
_tempChord.axes[1] = (value) => { return value < -0.3 }
spaciblo.input.DefaultInputSchema.addControllerChord(_tempChord)

_tempChord = spaciblo.input._generateOculusTouchChord('left', true, true, spaciblo.input.DefaultInputSchema.getAction('translate-backward'))
_tempChord.axes[1] = (value) => { return value > 0.3 }
spaciblo.input.DefaultInputSchema.addControllerChord(_tempChord)

_tempChord = spaciblo.input._generateOculusTouchChord('left', true, true, spaciblo.input.DefaultInputSchema.getAction('translate-left'))
_tempChord.axes[0] = (value) => { return value > 0.3 }
spaciblo.input.DefaultInputSchema.addControllerChord(_tempChord)

_tempChord = spaciblo.input._generateOculusTouchChord('left', true, true, spaciblo.input.DefaultInputSchema.getAction('translate-right'))
_tempChord.axes[0] = (value) => { return value < -0.3 }
spaciblo.input.DefaultInputSchema.addControllerChord(_tempChord)

_tempChord = spaciblo.input._generateOculusTouchChord('right', true, true, spaciblo.input.DefaultInputSchema.getAction('rotate-left'))
_tempChord.axes[0] = (value) => { return value < -0.3 }
spaciblo.input.DefaultInputSchema.addControllerChord(_tempChord)

_tempChord = spaciblo.input._generateOculusTouchChord('right', true, true, spaciblo.input.DefaultInputSchema.getAction('rotate-right'))
_tempChord.axes[0] = (value) => { return value > 0.3 }
spaciblo.input.DefaultInputSchema.addControllerChord(_tempChord)

_tempChord = spaciblo.input._generateOculusTouchChord('left', true, false, spaciblo.input.DefaultInputSchema.getAction('left-point'))
_tempChord.buttons[0].touched = true
spaciblo.input.DefaultInputSchema.addControllerChord(_tempChord)

_tempChord = spaciblo.input._generateOculusTouchChord('right', true, false, spaciblo.input.DefaultInputSchema.getAction('right-point'))
_tempChord.buttons[0].touched = true
spaciblo.input.DefaultInputSchema.addControllerChord(_tempChord)

spaciblo.input._defaultKeyChords = [
	[38, false, false, false, false, 'translate-forward'],
	[87, false, false, false, false, 'translate-forward'],

	[40, false, false, false, false, 'translate-backward'],
	[83, false, false, false, false, 'translate-backward'],

	[69, false, false, false, false, 'translate-left'],
	[81, false, false, false, false, 'translate-right'],

	[82, false, false, false, false, 'translate-up'],
	[70, false, false, false, false, 'translate-down'],

	[65, false, false, false, false, 'rotate-left'],
	[68, false, false, false, false, 'rotate-right'],

	[37, false, false, false, false, 'rotate-left'],
	[39, false, false, false, false, 'rotate-right'],

	[88, false, false, false, false, 'toggle-flock']
]
spaciblo.input._defaultKeyChords.forEach((chord, index) => {
	chord[5] = spaciblo.input.DefaultInputSchema.getAction(chord[5])
	spaciblo.input.DefaultInputSchema.addKeyChord(new spaciblo.input.KeyChord(...chord))
})

/*
InputManager tracks user input (keyboard, gamepad, etc) and translates them into a list of current Actions
It also keeps a few 3D data structures (rotation, translation) used by the renderer in each frame render
*/
spaciblo.input.InputManager = k.eventMixin(class {
	constructor(environment){
		this.environment = environment
		this.throttledSendAvatarUpdate = be.ui.throttle(this._sendAvatarUpdate, 100)
		this.inputSchema = spaciblo.input.DefaultInputSchema
		this.currentActions = new Set()
		this.currentKeyChord = null
		this.currentControllerChords = new Map() // gamepad index -> ControllerChord or null

		this.keyboardTranslationDelta = 1.9 // Meters per second
		this.keyboardRotationDelta = 1.2 // Radians per second

		this.touchTranslationDelta = 2.5 // Meters per second
		this.touchRotationDelta = 1.8 // Radians per second

		// When the user input indicates they want to rotate or translate, these are non zero
		this._inputRotation =    [0,0,0]
		this._inputTranslation = [0,0,0] // xyz translation in camera direction

		document.onkeydown = ev => { this._handleKeyDown(ev) }
		document.onkeyup   = ev => { this._handleKeyUp(ev)   }
	}
	isActionActive(name){
		let action = this.inputSchema.getAction(name)
		if(action === null){
			console.error('No such action', action)
			return false
		}
		return this.currentActions.has(action)
	}
	_toggleAction(action, active=null){
		/*
		Iff there is a change to the action activity, add or delete it in currentActions and trigger an InputActionStarted or InputActionEnded event.
		*/
		if(typeof action === 'undefined' || action === null) return
		if(active === null){
			active = !this.currentActions.has(action)
		}
		if(active === true  && this.currentActions.has(action) === false){
			this.currentActions.add(action)
			console.log('started action', action)
			this.trigger(spaciblo.events.InputActionStarted, action)
		}
		if(active === false && this.currentActions.has(action) === true){
			this.currentActions.delete(action)
			console.log('ended action', action)
			this.trigger(spaciblo.events.InputActionEnded, action)
		}
	}

	updateGamepadActions(){
		/*
		Called by the renderer in every frame to update actions based on gamepad(s) state
		*/
		// For each gamepad, update the list of current controller chords and notify for any changes
		let gamepads = navigator.getGamepads()
		for(let i=0; i < gamepads.length; i++){
			let currentChord = this.currentControllerChords.get(i)
			if(gamepads[i] === null){
				// The gamepad disappeared, so make sure we don't have old actions for it
				if(typeof currentChord !== 'undefined'){
					this.currentControllerChords.delete(i)
					this._toggleAction(currentChord.action, false)
				}
				continue
			}
			// Ok, it's a live gamepad so let's create a chord and see if it matches its existing chord (if any)
			let newChord = new spaciblo.input.ControllerChord()
			newChord.setFromGamepad(gamepads[i])
			newChord.action = this.inputSchema.getControllerChordAction(newChord)
			this.currentControllerChords.set(i, newChord)
			if(typeof currentChord !== 'undefined'){
				if(currentChord.action === newChord.action){
					continue
				}
				this._toggleAction(currentChord.action, false)
			}
			this._toggleAction(newChord.action, true)
			if(this._updateVectors()){
				this._sendAvatarUpdate()
			}
		}
	}

	// Touch input methods
	/*
	deltaX and deltaY should be in range [-1,1]
	*/
	handleTouchMotion(deltaX, deltaY){
		let oldRotation = [...this.inputRotation]
		let oldTranslation = [...this.inputTranslation]
		this._inputTranslation[0] = 0
		this._inputTranslation[1] = 0
		this._inputTranslation[2] = this.touchTranslationDelta * deltaY
		this._inputRotation[0] = 0
		this._inputRotation[1] = this.touchRotationDelta * -deltaX
		this._inputRotation[2] = 0
		if(oldRotation.every((val, index) => { return val === this._inputRotation[index] }) === false || oldTranslation.every((val, index) => { return val === this._inputTranslation[index] }) === false) {
			this.throttledSendAvatarUpdate()
		}
	}
	handleTouchEnd(){
		this._inputTranslation[0] = 0
		this._inputTranslation[1] = 0
		this._inputTranslation[2] = 0
		this._inputRotation[0] = 0
		this._inputRotation[1] = 0
		this._inputRotation[2] = 0
		this.throttledSendAvatarUpdate()
	}

	// Keyboard input methods
	_handleKeyDown(ev){
		let keyChord = new spaciblo.input.KeyChord()
		keyChord.setFromEvent(ev)
		this._handleKeyChordDown(keyChord)
	}
	_handleKeyUp(ev){
		let keyChord = new spaciblo.input.KeyChord()
		keyChord.setFromEvent(ev)
		this._handleKeyChordUp(keyChord)
	}
	_handleKeyChordUp(keyChord){
		if(this.currentKeyChord === null){
			return
		}
		if(keyChord.isModifier()){
			keyChord.keyCode = this.currentKeyChord.keyCode
		}
		if(this.currentKeyChord.chordEqual(keyChord)){
			this._replaceKeyChord(null)
			return
		}
		this._replaceKeyChord(keyChord)
		return
	}
	_handleKeyChordDown(keyChord){
		if(keyChord.isModifier()){
			// If it is just a modifier change and there's no current chord, abort
			if(this.currentKeyChord === null){
				return
			}
			// Roll the old keyCode into the new chord
			keyChord.keyCode = this.currentKeyChord.keyCode
		}
		if(this.currentKeyChord && this.currentKeyChord.chordEqual(keyChord)){
			return
		}
		this._replaceKeyChord(keyChord)
	}
	_replaceKeyChord(keyChord){
		// It's a new chord, so remove the old chord and its action
		if(this.currentKeyChord && this.currentKeyChord.action !== null){
			this._toggleAction(this.currentKeyChord.action, false)
		}
		this.currentKeyChord = keyChord
		if(this.currentKeyChord !== null){
			// Find the chord's action (if any) and add it to current actions
			this.currentKeyChord.action = this.inputSchema.getKeyChordAction(this.currentKeyChord)
			if(this.currentKeyChord.action !== null){
				this._toggleAction(this.currentKeyChord.action, true)
			}
		}
		if(this._updateVectors()){
			this._sendAvatarUpdate()
		}
	}

	// Returns true if the rotation or translation changed
	_updateVectors(){
		let oldRotation = [...this.inputRotation]
		let oldTranslation = [...this.inputTranslation]
		if(this.isActionActive('rotate-left')){
			this._inputRotation[0] = 0
			this._inputRotation[1] = this.keyboardRotationDelta
			this._inputRotation[2] = 0
		} else if(this.isActionActive('rotate-right')){
			this._inputRotation[0] = 0
			this._inputRotation[1] = -1 * this.keyboardRotationDelta
			this._inputRotation[2] = 0
		} else {
			this._inputRotation[0] = 0
			this._inputRotation[1] = 0
			this._inputRotation[2] = 0
		}
		if(this.isActionActive('translate-forward')){
			this._inputTranslation[0] = 0
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = -1 * this.keyboardTranslationDelta
		} else if(this.isActionActive('translate-backward')){
			this._inputTranslation[0] = 0
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = this.keyboardTranslationDelta
		} else if(this.isActionActive('translate-left')){
			this._inputTranslation[0] = this.keyboardTranslationDelta
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = 0
		} else if(this.isActionActive('translate-right')){
			this._inputTranslation[0] = -1 * this.keyboardTranslationDelta
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = 0
		} else if(this.isActionActive('translate-up')){
			this._inputTranslation[0] = 0
			this._inputTranslation[1] = 1 * this.keyboardTranslationDelta
			this._inputTranslation[2] = 0
		} else if(this.isActionActive('translate-down')){
			this._inputTranslation[0] = 0
			this._inputTranslation[1] = -1 * this.keyboardTranslationDelta
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
		// Consider using this.throttledSendAvatarUpdate in code that's called for each frame
		this.trigger(spaciblo.events.AvatarMotionChanged, this._inputTranslation, this._inputRotation)
	}

	// Query methods called by the renderer during frame rendering
	get inputTranslation() { return this._inputTranslation }
	get inputRotation() { return this._inputRotation }
})

// Map key codes to names
spaciblo.input.KeyMap = new Map()
spaciblo.input.KeyMap.set(37, 'left-arrow')
spaciblo.input.KeyMap.set(38, 'up-arrow')
spaciblo.input.KeyMap.set(39, 'right-arrow')
spaciblo.input.KeyMap.set(40, 'down-arrow')
spaciblo.input.KeyMap.set(81, 'q')
spaciblo.input.KeyMap.set(87, 'w')
spaciblo.input.KeyMap.set(69, 'e')
spaciblo.input.KeyMap.set(65, 'a')
spaciblo.input.KeyMap.set(83, 's')
spaciblo.input.KeyMap.set(68, 'd')
spaciblo.input.KeyMap.set(82, 'r')
spaciblo.input.KeyMap.set(70, 'f')
spaciblo.input.KeyMap.set(88, 'x')
spaciblo.input.KeyMap.set(16, 'shift')
spaciblo.input.KeyMap.set(17, 'control')
spaciblo.input.KeyMap.set(18, 'alt')
spaciblo.input.KeyMap.set(224, 'meta')

// A list of modifier keys like shift, alt, control, and meta
spaciblo.input.MODIFIER_KEYCODES = [16, 17, 18, 224]

// A handy call when debugging within animation frames, logs messages at most once per second
spaciblo.input.throttledConsoleLog = be.ui.throttle(function(...params){
	console.log(...params)
}, 1000)

