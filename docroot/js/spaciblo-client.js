"use strict";
/*
Utilities for use by template client side scripts, which are run in workers.
*/
var spaciblo = spaciblo || {}
spaciblo.client = spaciblo.client || {}

spaciblo.client.TemplateWorker = class {
	constructor(){
		onmessage = this.onMessage.bind(this)
	}
	onMessage(ev){
		switch(ev.data.name){
			case 'init':
				this.init(ev.data)
				postMessage(new spaciblo.client.WorkerReadyMessage())
				break
			case 'group-added':
				this.handleGroupAdded(ev.data)
				break
			case 'group-deleted':
				this.handleGroupDeleted(ev.data)
				break
			case 'template-group-added':
				this.handleTemplateGroupAdded(ev.data)
				break
			case 'template-group-deleted':
				this.handleTemplateGroupDeleted(ev.data)
				break
			case 'group-clicked':
				this.handleGroupClicked(ev.data)
				break
			case 'input-action-started':
				this.handleInputActionStarted(ev.data)
				break
			case 'input-action-ended':
				this.handleInputActionEnded(ev.data)
				break
			case 'avatar-info':
				this.handleAvatarInfo(ev.data)
				break
			case 'point-intersect':
				this.handlePointIntersect(ev.data)
				break
			default:
				console.error('TemplateWorker received unknown message name', ev.data)
		}
	}

	// Extending classes override these to handle each message type
	init(data){}
	handleGroupAdded(group){} 
	handleGroupRemoved(group){}
	handleTemplateGroupAdded(group){} 
	handleTemplateGroupRemoved(group){}
	handleInputActionStarted(action){}
	handleInputActionEnded(action){}
	handleAvatarInfo(data){}
	handlePointIntersect(data){}

	handleGroupClicked(group){}
}

/*
A helper TemplateWorker that does all of the book keeping to track subscription information like:
	- active actions
	- current pointing intersects for each hand and gaze
	- the avatar group
	- current template
	- added and removed groups
	- added and remove template groups
*/
spaciblo.client.TrackingTemplateWorker = class extends spaciblo.client.TemplateWorker {
	constructor(subscribeToActions=false, subscribeToPointing=false, subscribeToGroups=false, subscribeToTemplateGroups=false){
		super()
		this._subscribedToActions = subscribeToActions
		this._subscribedToPointing = subscribeToPointing
		this._subscribedToGroups = subscribeToGroups
		this._subscribedToTemplateGroups = subscribeToTemplateGroups

		this._groups = new Set()		// Groups as they are added and removed from the scene
		this._templateGroups = new Set() // Groups that use this template worker as they are added and removed
		this._templateUUID = null 		// The template UUID that this worker is supporting
		this._activeActions = new Set() // Active actions like 'point', 'left-point', 'translate-forward' 
		this._gazePoint = null			// The pointing data when the user is gazing at a group in the scene
		this._leftPoint = null			// The pointing data when the user is left pointing at a group
		this._rightPoint = null			// The pointing data when the user is right pointing at a group
		this._avatarGroup = null		// The group for the local user's avatar
	}
	init(data){
		this._templateUUID = data.templateUUID
		postMessage(new spaciblo.client.QueryAvatarMessage())
		if(this._subscribedToActions){
			postMessage(new spaciblo.client.InputActionSubscriptionMessage({ subscribed: true }))
		}
		if(this._subscribedToPointing){
			postMessage(new spaciblo.client.PointIntersectSubscriptionMessage({ subscribed: true }))
		}
		if(this._subscribedToGroups){
			postMessage(new spaciblo.client.GroupExistenceSubscriptionMessage({ subscribed: true }))
		}
		if(this._subscribedToTemplateGroups){
			postMessage(new spaciblo.client.TemplateGroupExistenceSubscriptionMessage({ subscribed: true }))
		}
	}

	get subscribedToActions() { return this._subscribedToActions }
	set subscribedToActions(value) {
		if(value === this._subscribedToActions) return
		this._subscribedToActions = value
		postMessage(new spaciblo.client.InputActionSubscriptionMessage({ subscribed: this._subscribedToActions }))
	}
	get subscribedToPointing() { return this._subscribedToPointing }
	set subscribedToPointing(value) {
		if(value === this._subscribedToPointing) return
		this._subscribedToPointing = value
		postMessage(new spaciblo.client.PointIntersectSubscriptionMessage({ subscribed: this._subscribedToPointing }))
	}
	get subscribedToGroups() { return this._subscribedToGroups }
	set subscribedToGroups(value) {
		if(value === this._subscribedToGroups) return
		this._subscribedToGroups = value
		postMessage(new spaciblo.client.GroupExistenceSubscriptionMessage({ subscribed: this._subscribedToGroups }))
	}
	get subscribedToTemplateGroups() { return this._subscribedToTemplateGroups }
	set subscribedToTemplateGroups(value) {
		if(value === this._subscribedToTemplateGroups) return
		this._subscribedToTemplateGroups = value
		postMessage(new spaciblo.client.TemplateGroupExistenceSubscriptionMessage({ subscribed: this._subscribedToTemplateGroups }))
	}

	handleAvatarInfo(data){
		this._avatarGroup = data.group
	}
	get avatarGroup() { return this._avatarGroup }

	handleInputActionStarted(event){
		this._activeActions.add(event.action.name)
	}
	handleInputActionEnded(event){
		this._activeActions.delete(event.action.name)
	}
	actionIsActive(actionName){
		return this._activeActions.has(actionName)
	}

	handleGroupAdded(group){
		this._groups.add(group)
	}
	handleGroupRemoved(group){
		this._groups.delete(group)
	}
	handleTemplateGroupAdded(group){
		this._templateGroups.add(group)
	}
	handleTemplateGroupRemoved(group){
		this._templateGroups.remove(group)
	}
	handlePointIntersect(data){
		switch(data.pointer){
			case 'gaze':
				if(data.group === null || data.group.templateUUID !== this._templateUUID){
					this._gazePoint = null
				} else {
					this._gazePoint = data
				}
				break
			case 'left':
				if(data.group === null || data.group.templateUUID !== this._templateUUID){
					this._leftPoint = null
				} else {
					this._leftPoint = data
				}
				break
			case 'right':
				if(data.group === null || data.group.templateUUID !== this._templateUUID){
					this._rightPoint = null
				} else {
					this._rightPoint = data
				}
				break
			default:
				return
		}
	}
	get gazePoint(){ return this._gazePoint }
	get leftPoint(){ return this._leftPoint }
	get rightPoint(){ return this._rightPoint }
}

/*
PressableTemplateWorker just listens for when the user points at and then presses a template group
Extending classes should implement handlePress
*/
spaciblo.client.PressableTemplateWorker = class extends spaciblo.client.TrackingTemplateWorker {
	constructor(){
		super(true, true, false, true)
	}
	handleInputActionStarted(event){
		super.handleInputActionStarted(event)
		let group = null
		switch(event.action.name){
			case 'press':
				if(this.actionIsActive('point') && this.gazePoint !== null){
					group = this.gazePoint.group
				}
				break
			case 'left-press':
				if(this.actionIsActive('left-point') && this.leftPoint !== null){
					group = this.leftPoint.group
				}
				break
			case 'right-press':
				if(this.actionIsActive('right-point') && this.rightPoint !== null){
					group = this.rightPoint.group
				}
				break
		}
		if(group != null){
			this.handlePress(group)
		}
	}
	handlePress(group){
		// This is the method extending classes should implement to handle presses
		throw 'Not implemented'
	}
}

/*
The base message type used between a Template's client side script and the rest of the system 
*/
spaciblo.client.Message = class {
	constructor(name, values={}){
		this.name = name
		Object.assign(this, values)
	}
}

/*
InitMessage is sent when a TemplateWorker has been created and added to the TemplateManager
values:
	templateUUID: string
*/
spaciblo.client.InitMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('init', values)
	}
}

/*
Sent by the worker script to signal that it is ready to receive events
*/
spaciblo.client.WorkerReadyMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('worker-ready', values)
	}
}

/*
Sent by the client worker to fetch the group information for the local avatar
*/
spaciblo.client.QueryAvatarMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('query-avatar', values)
	}
}

/*
A response to a QueryAvatarMessage
values:
	group: a dict representing the scene graph of the avatar
*/
spaciblo.client.AvatarInfoMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('avatar-info', values)
	}
}

/*
Sent by the client worker to change the local avatar
values:
	PORTS
*/
spaciblo.client.UpdateAvatarMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('update-avatar', values)
	}
}

/*
Sent by the client worker to teleport the local avatar
values:
	pointer: 'left', 'right', 'gaze'
*/
spaciblo.client.TeleportAvatarMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('teleport-avatar', values)
	}
}

/*
Sent when the worker wants to change the position, orientation, rotation, translation, or scale of a group
To change the local avatar, use UpdateAvatarMessage
*/
spaciblo.client.ChangePORTSMessage = class extends spaciblo.client.Message {
	constructor(id, values={}){
		super('change-ports', values)
		this.id = id // The group id
	}
}

/*
Fired when the user initiates some input action like 'translate-forward' or 'point'
values:
	action: { name }
*/
spaciblo.client.InputActionStartedMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('input-action-started', values)
	}
}

/*
Fired when the user terminates some input action like 'translate-forward' or 'point'
values:
	action: { name }
*/
spaciblo.client.InputActionEndedMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('input-action-ended', values)
	}
}

/*
Values:
	subscribed: bool // if true, listen for InputActionStarted/Ended messages
*/
spaciblo.client.InputActionSubscriptionMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('input-action-subscription', values)
	}
}

/*
Values:
	subscribed: bool // if true, listen for PointIntersection messages
*/
spaciblo.client.PointIntersectSubscriptionMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('point-intersect-subscription', values)
	}
}

/*
Values:
	subscribed: bool // if true, listen for the creation and deletion of all groups messages
*/
spaciblo.client.GroupExistenceSubscriptionMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('group-existence-subscription', values)
	}
}

/*
Values:
	subscribed: bool // if true, listen for the creation and deletion of groups using this worker's template
*/
spaciblo.client.TemplateGroupExistenceSubscriptionMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('template-group-existence-subscription', values)
	}
}

/*
Fired when what the user is pointing at is set or unset
values:
	pointer: 'left', 'right', 'gaze'
	group: the template group's scene graph
	target: the group within the template group that was intersected by the point
*/
spaciblo.client.PointIntersectMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('point-intersect', values)
	}
}

/*
Fired when any group is added to the scene, regardless of its template
values:
	group: the group's scene graph
*/
spaciblo.client.GroupAddedMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('group-added', values)
	}
}

/*
Fired when any group is removed from the scene, regardless of its template
values:
	groupID: int
*/
spaciblo.client.GroupDeletedMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('group-deleted', values)
	}
}

/*
Fired when a group with the worker's template is added to the scene
values:
	group: the group's scene graph
*/
spaciblo.client.TemplateGroupAddedMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('template-group-added', values)
	}
}

/*
Fired when a group with the worker's template is removed from the scene
values:
	groupID: int
*/
spaciblo.client.TemplateGroupDeletedMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('template-group-deleted', values)
	}
}

// TODO switch this to an input action event
spaciblo.client.GroupClickedMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('group-clicked', values)
	}
}
