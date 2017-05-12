"use strict";
/*
Utilities for use by template client side scripts, which are run in workers.
*/
var spaciblo = spaciblo || {}
spaciblo.client = spaciblo.client || {}

spaciblo.client.TemplateWorker = class {
	constructor(){
		this.groups = new Map() // id -> {}
		onmessage = this.onMessage.bind(this)
	}
	onMessage(ev){
		switch(ev.data.name){
			case 'init':
				this._init(ev.data)
				break
			case 'group-added':
				this._handleGroupAdded(ev.data)
				break
			case 'group-removed':
				this._handleGroupRemoved(ev.data)
				break
			case 'group-clicked':
				this.handleGroupClicked(ev.data)
				break
			default:
				console.error('TemplateWorker received unknown message name', ev.data)
		}
	}

	// Extending classes override these to handle each message type
	init(){}
	handleGroupAdded(id){} 
	handleGroupRemoved(id){}
	handleGroupClicked(id){}

	_init(data){
		this.init()
	}
	_handleGroupAdded(data){
		if(this.groups.has(data.id)) return
		this.groups.set(data.id, {})
		this.handleGroupAdded(data.id)
	}

	_handleGroupRemoved(data){
		if(this.groups.has(data.id) === false) return
		this.groups.delete(data.id)
		this.handleGroupRemoved(data.id)
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
*/
spaciblo.client.InitMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('init', values)
	}
}

spaciblo.client.GroupAddedMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('group-added', values)
	}
}

spaciblo.client.GroupRemovedMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('group-removed', values)
	}
}

spaciblo.client.GroupClickedMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('group-clicked', values)
	}
}

spaciblo.client.ChangePORTSMessage = class extends spaciblo.client.Message {
	constructor(id, values={}){
		super('change-ports', values)
		this.id = id
	}
}
