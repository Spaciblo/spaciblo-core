"use strict";

var spaciblo = spaciblo || {}
spaciblo.events = spaciblo.events || {}
spaciblo.components = spaciblo.components || {}

spaciblo.events.SpaceSelected = 'spaciblo-space-selected'
spaciblo.events.RendererExitedVR = 'spaciblo-exited-vr'
spaciblo.events.AvatarMotionChanged = 'spaciblo-avatar-motion-changed'
spaciblo.events.TouchMotion = 'spaciblo-touch-motion'
spaciblo.events.EndTouch = 'spaciblo-end-tough'
spaciblo.events.InputActionStarted = 'spaciblo-input-action-started'
spaciblo.events.InputActionEnded = 'spaciblo-input-action-ended'
spaciblo.events.GamepadAdded = 'spaciblo-gamepad-added'
spaciblo.events.GamepadRemoved = 'spaciblo-gamepad-removed'

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

		this.router.addListener(this._handleRoutes.bind(this))
		this.router.start()
	}
	_handleRoutes(routeName, ...params){
		switch(routeName){
			case 'space':
				this.spacesComponent.handleSpaceRoute(params[0])
				break
			default:
				// Do nothing. The SpacesComponent shows a menu.
				break
		}
	}
	handleAddedToDOM(){
		this.spacesComponent.handleAddedToDOM()
	}
}

/*
SpacesComponent manages a spaciblo.three.Renderer that displays spaces
*/
spaciblo.components.SpacesComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('spaces-component')
		this.inputManager = new spaciblo.input.InputManager(spaciblo.input.DefaultInputSchema)
		this.client = null // Will be a spaciblo.api.Client when a Space is selected
		this.vrDisplay = null
		this.receivedTouchEvent = false // Set to true iff the first touch event arrives

		this.renderer = new spaciblo.three.Renderer(this.inputManager)
		this.el.appendChild(this.renderer.el)

		this.dataObject.addListener(this.handleReset.bind(this), "reset")
		if(this.dataObject.length > 0){
			this.handleReset()
		}

		this.vrButton = k.el.div({ class:'vr-button' }, 'Enter VR').appendTo(this.el)

		this.touchMotionComponent = new spaciblo.components.TouchMotionComponent()
		this.el.appendChild(this.touchMotionComponent.el)
		this.touchMotionComponent.addListener(this.handleTouchMotion.bind(this), spaciblo.events.TouchMotion)
		this.touchMotionComponent.addListener(this.handleEndTouch.bind(this), spaciblo.events.EndTouch)

		this.updateSize()

		window.addEventListener('touchstart', ev => { this.handleTouchStart(ev) }, false)
		window.addEventListener('resize', () => { this.updateSize() })
		this.renderer.addListener(this.handleSpaceSelected.bind(this), spaciblo.events.SpaceSelected)
		this.renderer.addListener(this.handleExitedVR.bind(this), spaciblo.events.RendererExitedVR)
		this.inputManager.addListener(this.handleAvatarMotion.bind(this), spaciblo.events.AvatarMotionChanged)
		spaciblo.getVRDisplays().then(this.handleVRDisplays.bind(this))
	}
	handleAddedToDOM(){
		this.updateSize()
		this.touchMotionComponent.render()
	}
	handleTouchStart(ev){
		if(this.receivedTouchEvent === false){
			this.receivedTouchEvent = true
			this.touchMotionComponent.el.style.display = 'block'
			this.touchMotionComponent.render()
		}
	}
	handleTouchMotion(eventName, deltaX, deltaY){
		this.inputManager.handleTouchMotion(deltaX, deltaY)
	}
	handleEndTouch(){
		this.inputManager.handleTouchEnd()
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
		this.enterVR()
	}
	handleExitedVR(renderer){
		if(this.receivedTouchEvent){
			this.touchMotionComponent.el.style.display = 'inline-block'
		}
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
				if(this.receivedTouchEvent){
					this.touchMotionComponent.el.style.display = 'none'
				}
				this.renderer.setVRDisplay(this.vrDisplay)
			}).catch(e => {
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
	handleSpaceSelected(eventName, space){
		document.location.hash = '#' + space.get('uuid')
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