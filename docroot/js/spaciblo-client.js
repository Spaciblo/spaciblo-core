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
	handleGroupClicked(group){}
	handleInputActionStarted(action){}
	handleInputActionEnded(action){}
	handleAvatarInfo(data){}
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
