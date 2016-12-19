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
		window.addEventListener('gamepadconnected', ev => { this.handleGamepadConnected(ev) })
		this.renderer.addListener(this.handleSpaceSelected.bind(this), spaciblo.events.SpaceSelected)
		this.renderer.addListener(this.handleAvatarMotion.bind(this), spaciblo.events.AvatarMotionChanged)

		spaciblo.getVRDisplays().then(this.handleVRDisplays.bind(this))
	}
	handleGamepadConnected(ev){
		console.log("TODO handle gamepad input", event)
	}
	handleVRDisplays(displays){
		console.log("VR displays", displays)
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
	handleAvatarMotion(eventName, position, orientation, translationVector, rotationVector){
		if(this.client === null){
			return
		}
		this.client.sendAvatarUpdate(position, orientation, translationVector, rotationVector)
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

spaciblo.components.InputManager = k.eventMixin(class {
	constructor(){
		this.keysDown = new Set()
		this.keyboardRotationDelta = 1.2 // Radians per second
		this.keyboardTranslationDelta = 1.9 // Meters per second
		document.onkeydown = this.handleKeyDown.bind(this)
		document.onkeyup = this.handleKeyUp.bind(this)
	}
	handleKeyDown(ev){
		this.keysDown.add(ev.keyCode)
	}
	handleKeyUp(ev){
		this.keysDown.delete(ev.keyCode)
	}
	isDown(keyCode){
		return this.keysDown.has(keyCode)
	}
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