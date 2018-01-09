'use strict'

/*
Input related code that handles user events from the keyboard, gamepad, etc and generates high level action events.

Look in spaciblo-default-input-schema.js for the specific mapping of key presses, touch events, or gamepad inputs to actions.
*/

var spaciblo = spaciblo || {}
spaciblo.input = spaciblo.input || {}
spaciblo.events = spaciblo.events || {}

spaciblo.events.EnvironmentChanged = 'spaciblo-environment-changed'

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

// A single input (button, touch, axis) from a gamepad (XBox controller, Oculus Touch, Vive controller...)
spaciblo.input.ControllerInput = class {
	constructor(idRegex, hand=null, button=null, touch=null, axis=null, action=null){
		this.idRegex = idRegex
		this.hand = hand		// 'left', 'right', '', null
		this.button = button	// int id, null
		this.touch = touch		// int id, null
		this.axis = axis		// int id, null
		this.value = null		// float, null
		this.action = action
	}
	matches(obj){
		if(this._typeIsEqual(this, obj) === false) return false
		if(this.idRegex !== obj.idRegex) return false
		if(this.hand !== null && this.hand !== obj.hand) return false
		if(this.button !== null && this.button !== obj.button) return false
		if(this.touch !== null && this.touch !== obj.touch) return false
		if(this.axis !== null && this.axis !== obj.axis) return false
		return true
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

// Maps key codes and ControllerChords to Actions
spaciblo.input.InputSchema = class {
	constructor(){
		this._keyCodeActions = new Map() // key code int -> { action: Action, value: null | value }
		this._controllerInputs = new Set()
		this._actions = new Map() // name to InputAction
	}
	addAction(action){
		this._actions[action.name] = action
	}
	getAction(name){
		return this._actions[name]
	}
	addKeyCodeAction(keyCode, action, value=null){
		if(action == false) throw 'Can not add a key code with no action'
		this._keyCodeActions.set(keyCode, {
			action: action,
			value: value
		})
	}
	getKeyCodeAction(keyCode){
		const actionInfo = this._keyCodeActions.get(keyCode)
		if(!actionInfo) return null
		actionInfo.action.value = actionInfo.value
		return actionInfo.action
	}
	addControllerInput(controllerInput){
		if(controllerInput.action == false) throw 'Can not add a controller input with no action'
		this._controllerInputs.add(controllerInput)
	}
	getControllerInputAction(controllerInput){
		for(let input of this._controllerInputs){
			if(input.matches(controllerInput)){
				return input.action
			}
		}
		return null
	}
}

/*
InputManager tracks user input (keyboard, gamepad/controller, touch UI) and translates it into a list of current Actions
*/
spaciblo.input.InputManager = k.eventMixin(class {
	constructor(environment){
		this._environment = environment
		this._inputSchema = spaciblo.input.DefaultInputSchema
		this._currentActions = new Set()
		this._pressedKeys = new Set() // the keycodes for each key that is currently down
		this._touchDeltaX = 0
		this._touchDeltaY = 0

		// Keep track of which keys are down, to be used in updateActions
		document.onkeydown = ev => {
			this._pressedKeys.add(ev.keyCode)
		}
		document.onkeyup = ev => {
			this._pressedKeys.delete(ev.keyCode)
		}
	}
	isActionActive(name){
		let action = this._inputSchema.getAction(name)
		if(action === null){
			console.error('No such action', action)
			return false
		}
		return this._currentActions.has(action)
	}
	_toggleAction(action, active=null){
		/*
		Iff there is a change to the action activity, add or delete it in currentActions and trigger an InputActionStarted or InputActionEnded event.
		*/
		if(typeof action === 'undefined' || action === null) return
		if(active === null){
			active = !this._currentActions.has(action)
		}
		if(active === true  && this._currentActions.has(action) === false){
			this._currentActions.add(action)
			this.trigger(spaciblo.events.InputActionStarted, action)
		}
		if(active === false && this._currentActions.has(action) === true){
			this._currentActions.delete(action)
			this.trigger(spaciblo.events.InputActionEnded, action)
		}
	}

	// Called by the renderer at the beginning of every frame to update actions based on gamepad(s), keyboard, and touch state
	updateActions(){
		let newActions = []

		// Collect actions from gamepads
		for(let gamepad of navigator.getGamepads()){
			if(gamepad === null) continue

			// Find the regex for this gamepad
			const idRegex = spaciblo.input.CONTROLLER_ID_REGEXES.find(reg => {
				return gamepad.id.match(reg) !== null
			}) || spaciblo.input.UNKNOWN_CONTROLLER_ID_REGEX

			// Collect actions for each button press
			for(let b=0; b < gamepad.buttons.length; b++){
				if(gamepad.buttons[b].pressed === false) continue
				const action = this._inputSchema.getControllerInputAction(new spaciblo.input.ControllerInput(
					idRegex, gamepad.hand, b, null, null
				))
				if(action !== null){
					action.value = gamepad.buttons[b].value
					newActions[newActions.length] = action
				}
			}
			// Collect actions for each button touch
			for(let b=0; b < gamepad.buttons.length; b++){
				if(gamepad.buttons[b].touched === false) continue
				const action = this._inputSchema.getControllerInputAction(new spaciblo.input.ControllerInput(
					idRegex, gamepad.hand, null, b, null
				))
				if(action !== null){
					newActions[newActions.length] = action
				}
			}
			// Collect actions for each non-zero axis
			for(let i=0; i < gamepad.axes.length; i++){
				if(gamepad.axes[i] < 0.1 && gamepad.axes[i] > -0.1) continue
				const action = this._inputSchema.getControllerInputAction(new spaciblo.input.ControllerInput(
					idRegex, gamepad.hand, null, null, i
				))
				if(action !== null){
					action.value = gamepad.axes[i]
					newActions[newActions.length] = action
				}
			}
		}

		// Collect actions from pressed keys
		for(let keyCode of this._pressedKeys.values()){
			const action = this._inputSchema.getKeyCodeAction(keyCode)
			if(action !== null){
				newActions[newActions.length] = action
			}
		}

		// Collect action from touch input
		if(this._touchDeltaY > 0.3){
			newActions[newActions.length] = this._inputSchema.getAction('translate-backward')
		} else if(this._touchDeltaY < -0.3) {
			newActions[newActions.length] = this._inputSchema.getAction('translate-forward')
		}
		if(this._touchDeltaX > 0.3){
			newActions[newActions.length] = this._inputSchema.getAction('rotate-right')
		} else if(this._touchDeltaX < -0.3) {
			newActions[newActions.length] = this._inputSchema.getAction('rotate-left')
		}

		// Add and remove actions from the currentAction set
		for(let action of this._currentActions){
			if(newActions.includes(action) === false){
				this._toggleAction(action, false)
			}
		}
		for(let action of newActions){
			this._toggleAction(action, true)
		}
	}

	// Called by touch input UI to start motion actions
	handleTouchMotion(deltaX, deltaY){
		// deltaX and deltaY should be in range [-1,1]
		this._touchDeltaX = deltaX
		this._touchDeltaY = deltaY
	}
	// Called by touch input UI to end motion actions
	handleTouchEnd(){
		this._touchDeltaX = 0
		this._touchDeltaY = 0
	}
})

/*
Handy serializable gamepad info
*/
spaciblo.input.getGamepadInfo = function(){
	let data = []
	for(let gamepad of navigator.getGamepads()){
		if(gamepad === null){
			var gpInfo = null
		} else {
			var gpInfo = {
				id: gamepad.id,
				hand: gamepad.hand,
				buttons: [],
				axes: []
			}
			for(let i=0; i < gamepad.buttons.length; i++){
				gpInfo.buttons.push({
					index: i,
					pressed: gamepad.buttons[i].pressed,
					touched: gamepad.buttons[i].touched,
					value: gamepad.buttons[i].value,
				})
			}
			for(let i=0; i < gamepad.axes.length; i++){
				gpInfo.axes.push({
					index: i,
					value: gamepad.axes[i]
				})
			}
			if(gamepad.pose){
				gpInfo.pose = {
					'hand': gamepad.pose.hand,
					'hasPosition': gamepad.pose.hasPosition,
					'hasOrientation': gamepad.pose.hasOrientation,
					'hasLinearVelocity': Array.isArray(gamepad.pose.linearVelocity),
					'hasLinearAcceleration': Array.isArray(gamepad.pose.linearAcceleration),
					'hasAngularVelocity': Array.isArray(gamepad.pose.angularVelocity),
					'hasAngularAcceleration': Array.isArray(gamepad.pose.angularAcceleration),
				}
			}
			if(gamepad.hapticActuators){
				gpInfo.hapticActuators = gamepad.hapticActuators.length
			}
		}
		data[data.length] = gpInfo
	}
	return data
}

// A handy call when debugging within animation frames, logs messages at most once per second
spaciblo.input.throttledConsoleLog = be.ui.throttle(function(...params){
	console.log(...params)
}, 1000)

