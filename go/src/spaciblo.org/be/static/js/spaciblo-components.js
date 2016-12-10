var spaciblo = spaciblo || {}
spaciblo.events = spaciblo.events || {}
spaciblo.components = spaciblo.components || {}

spaciblo.events.SpaceSelected = 'spaciblo-space-selected'

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

		this.renderer = new spaciblo.three.Renderer(this.inputManager)
		this.el.appendChild(this.renderer.el)

		this.dataObject.addListener(this.handleReset.bind(this), "reset")
		if(this.dataObject.length > 0){
			this.handleReset()
		}

		this.updateSize()
		window.addEventListener('resize', () => { this.updateSize() })
		this.renderer.addListener(this.handleSpaceSelected.bind(this), spaciblo.events.SpaceSelected)
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
			case 'Joined-Space':
				console.log("Event data", JSON.parse(message.state))

				this.renderer.showSpace(message.uuid, JSON.parse(message.state))
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
		this.keyboardRotationDelta = 1.2
		this.keyboardTranslationDelta = 1.9
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