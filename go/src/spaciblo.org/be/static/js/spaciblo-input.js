"use strict"
/*
Input related code that handles user events from the keyboard, gamepad, etc
*/

var spaciblo = spaciblo || {}
spaciblo.input = spaciblo.input || {}

// Some combination of keys (e.g. shift control z)
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
	keysEqual(obj){
		if(typeof obj !== "object") return false
		if(obj instanceof spaciblo.input.KeyChord === false) return false
		if(obj.keyCode !== this.keyCode) return false
		if(obj.shift !== this.shift) return false
		if(obj.control !== this.control) return false
		if(obj.alt !== this.alt) return false
		return true
	}
}

// A high level user action, like "translate-forward", used by InputSchema
spaciblo.input.InputAction = class {
	constructor(name){
		this.name = name
	}
}

// Maps KeyChords to Actions (eventually other action types)
spaciblo.input.InputSchema = class {
	constructor(){
		this.keyChords = new Set()
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
			console.error("Cannot add a KeyChord with a null action", keyChord)
			return
		}
		this.keyChords.add(keyChord)
	}
	getKeyChordAction(keyChord){
		for(let chord of this.keyChords){
			if(chord.keysEqual(keyChord)){
				return chord.action
			}
		}
		return null
	}
}

// Set up a default input schema.
spaciblo.input.DefaultInputSchema = new spaciblo.input.InputSchema()
spaciblo.input._defaultActions = [
	"translate-forward",
	"translate-back",
	"translate-left",
	"translate-right",
	"rotate-left",
	"rotate-right",
]
spaciblo.input._defaultActions.forEach((name, index) => {
	spaciblo.input.DefaultInputSchema.addAction(new spaciblo.input.InputAction(name))
})
spaciblo.input._defaultChords = [
	[38, false, false, false, false, "translate-forward"],
	[87, false, false, false, false, "translate-forward"],

	[40, false, false, false, false, "translate-back"],
	[83, false, false, false, false, "translate-back"],

	[69, false, false, false, false, "translate-left"],
	[81, false, false, false, false, "translate-right"],

	[65, false, false, false, false, "rotate-left"],
	[68, false, false, false, false, "rotate-right"],

	[37, false, false, false, false, "rotate-left"],
	[39, false, false, false, false, "rotate-right"]

]
spaciblo.input._defaultChords.forEach((chord, index) => {
	chord[5] = spaciblo.input.DefaultInputSchema.getAction(chord[5])
	spaciblo.input.DefaultInputSchema.addKeyChord(new spaciblo.input.KeyChord(...chord))
})

/*
InputManager tracks user input (keyboard, gamepad, etc) and translates them into a list of current Actions
It also keeps a few 3D data structures (rotation, translation) used by the renderer in each frame render
*/
spaciblo.input.InputManager = k.eventMixin(class {
	constructor(inputSchema){
		this._throttledSendAvatarUpdate = spaciblo.input.throttle(this._sendAvatarUpdate, 100)
		this.inputSchema = inputSchema
		this.currentActions = new Set()
		this.currentKeyChord = null

		this.keyboardTranslationDelta = 1.9 // Meters per second
		this.keyboardRotationDelta = 1.2 // Radians per second

		this.touchTranslationDelta = 2.5 // Meters per second
		this.touchRotationDelta = 1.8 // Radians per second

		this._gamepads = {} // Gamepad.index -> Gamepad object

		// When the user input indicates they want to rotate or translate, these are non zero
		this._inputRotation =    [0,0,0]
		this._inputTranslation = [0,0,0] // xyz translation in camera direction

		document.onkeydown = ev => { this._handleKeyDown(ev) }
		document.onkeyup   = ev => { this._handleKeyUp(ev)   }
		window.addEventListener('gamepadconnected', ev => { this.handleGamepadConnected(ev) })
		window.addEventListener('gamepaddisconnected', ev => { this.handleGamepadDisconnected(ev) })
	}
	isActionActive(name){
		let action = this.inputSchema.getAction(name)
		if(action === null){
			console.error("No such action", action)
			return false
		}
		return this.currentActions.has(action)
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
			this._throttledSendAvatarUpdate()
		}
	}
	handleTouchEnd(){
		this._inputTranslation[0] = 0
		this._inputTranslation[1] = 0
		this._inputTranslation[2] = 0
		this._inputRotation[0] = 0
		this._inputRotation[1] = 0
		this._inputRotation[2] = 0
		this._throttledSendAvatarUpdate()
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
		if(this.currentKeyChord.keysEqual(keyChord)){
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
		if(this.currentKeyChord && this.currentKeyChord.keysEqual(keyChord)){
			return
		}
		this._replaceKeyChord(keyChord)
	}
	_replaceKeyChord(keyChord){
		// It's a new chord, so remove the old chord and its action
		if(this.currentKeyChord && this.currentKeyChord.action !== null){
			this.currentActions.delete(this.currentKeyChord.action)
		}
		this.currentKeyChord = keyChord
		if(this.currentKeyChord !== null){
			// Find the chord's action (if any) and add it to current actions
			this.currentKeyChord.action = this.inputSchema.getKeyChordAction(this.currentKeyChord)
			if(this.currentKeyChord.action !== null){
				this.currentActions.add(this.currentKeyChord.action)
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
		if(this.isActionActive("rotate-left")){
			this._inputRotation[0] = 0
			this._inputRotation[1] = this.keyboardRotationDelta
			this._inputRotation[2] = 0
		} else if(this.isActionActive("rotate-right")){
			this._inputRotation[0] = 0
			this._inputRotation[1] = -1 * this.keyboardRotationDelta
			this._inputRotation[2] = 0
		} else {
			this._inputRotation[0] = 0
			this._inputRotation[1] = 0
			this._inputRotation[2] = 0
		}
		if(this.isActionActive("translate-forward")) {
			this._inputTranslation[0] = 0
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = -1 * this.keyboardTranslationDelta
		} else if(this.isActionActive("translate-back")) {
			this._inputTranslation[0] = 0
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = this.keyboardTranslationDelta
		} else if(this.isActionActive("translate-left")) {
			this._inputTranslation[0] = this.keyboardTranslationDelta
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = 0
		} else if(this.isActionActive("translate-right")) {
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

// Map key codes to names
spaciblo.input.KeyMap = new Map()
spaciblo.input.KeyMap.set(37, "left-arrow")
spaciblo.input.KeyMap.set(38, "up-arrow")
spaciblo.input.KeyMap.set(39, "right-arrow")
spaciblo.input.KeyMap.set(40, "down-arrow")
spaciblo.input.KeyMap.set(81, "q")
spaciblo.input.KeyMap.set(87, "w")
spaciblo.input.KeyMap.set(69, "e")
spaciblo.input.KeyMap.set(65, "a")
spaciblo.input.KeyMap.set(83, "s")
spaciblo.input.KeyMap.set(68, "d")
spaciblo.input.KeyMap.set(16, "shift")
spaciblo.input.KeyMap.set(17, "control")
spaciblo.input.KeyMap.set(18, "alt")
spaciblo.input.KeyMap.set(224, "meta")

// A list of modifier keys like shift, alt, control, and meta
spaciblo.input.MODIFIER_KEYCODES = [16, 17, 18, 224]

spaciblo.input.throttle = function(func, wait, leading=true, trailing=true) {
	// Cribbed from https://github.com/jashkenas/underscore
	var timeout, context, args, result
	var previous = 0

	var later = function() {
		previous = leading === false ? 0 : Date.now()
		timeout = null
		result = func.apply(context, args)
		if (!timeout) context = args = null
	}

	var throttled = function() {
		var now = Date.now()
		if (!previous && leading === false) previous = now
		var remaining = wait - (now - previous)
		context = this
		args = arguments
		if (remaining <= 0 || remaining > wait) {
		if (timeout) {
			clearTimeout(timeout)
			timeout = null
		}
		previous = now
		result = func.apply(context, args)
		if (!timeout) context = args = null
		} else if (!timeout && trailing !== false) {
		timeout = setTimeout(later, remaining)
		}
		return result
	}

	throttled.cancel = function() {
		clearTimeout(timeout)
		previous = 0
		timeout = context = args = null
	}

	return throttled
}

// A handy call when debugging within animation frames, logs messages at most once per second
spaciblo.input.throttledConsoleLog = spaciblo.input.throttle(function(...params){
	console.log(...params)
}, 1000)
