"use strict";
/*
Utilities for use by template client side scripts, which are run in workers.
*/
var spaciblo = spaciblo || {}
spaciblo.client = spaciblo.client || {}

spaciblo.client.TemplateWorker = class {
	constructor(){
		onmessage = this.onMessage.bind(this)
		// If we loaded the be-api.js, listen for the schema population
		if(typeof be === 'object' && typeof be.api === 'object'){
			self.addEventListener("schema-populated", () => { this.handleSchemaPopulated() })
		}
	}
	onMessage(ev){
		switch(ev.data.name){
			case 'init':
				this.init(ev.data)
				postMessage(new spaciblo.client.WorkerReadyMessage())
				break
			case 'group-added':
				this.handleGroupAdded(ev.data.group)
				break
			case 'group-removed':
				this.handleGroupRemoved(ev.data.groupId)
				break
			case 'group-settings-changed':
				this.handleGroupSettingsChanged(ev.data.groupId, ev.data.changedKeys, ev.data.settings)
				break
			case 'template-group-added':
				this.handleTemplateGroupAdded(ev.data.group)
				break
			case 'template-group-removed':
				this.handleTemplateGroupRemoved(ev.data.groupId)
				break
			case 'template-group-settings-changed':
				this.handleTemplateGroupSettingsChanged(ev.data.groupId, ev.data.changedKeys, ev.data.settings)
				break
			case 'group-clicked':
				this.handleGroupClicked(ev.data.group)
				break
			case 'input-action-started':
				this.handleInputActionStarted(ev.data.action)
				break
			case 'input-action-ended':
				this.handleInputActionEnded(ev.data.action)
				break
			case 'avatar-info':
				this.handleAvatarInfo(ev.data.group)
				break
			case 'group-info':
				this.handleGroupInfo(ev.data.group)
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
	handleGroupInfo(group){}
	handleGroupAdded(group){} 
	handleGroupRemoved(groupId){}
	handleTemplateGroupAdded(group){} 
	handleTemplateGroupRemoved(groupId){}
	handleGroupSettingsChanged(groupId, changedKeys, settings) {}
	handleTemplateGroupSettingsChanged(groupId, changedKeys, settings) {}
	handleInputActionStarted(action){}
	handleInputActionEnded(action){}
	handlePointIntersect(data){}
	handleAvatarInfo(group){}
	handleSchemaPopulated(){}

	// TODO remove me because mouse clicks should be coming through the input manager
	handleGroupClicked(group){}

	// use a breadth first search for a group with a matching name
	findChildByName(name, group=null){
		if(group === null) return null
		for(let child of group.children){
			if(child.name === name) return child
		}
		for(let child of group.children){
			let match = this.findChildByName(name, child)
			if(match !== null) return match
		}
		return null
	}
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

		this._groups = new Map()		// id -> groups as they are added and removed from the scene
		this._templateGroups = new Map() // id -> groups that use this template worker as they are added and removed
		this._templateUUID = null 		// The template UUID that this worker is supporting

		this._activeActions = new Set() // Active actions like 'point', 'left-point', 'translate-forward' 
		this._avatarGroup = null		// The group for the local user's avatar

		this._gazePointInfo = null			// The pointing data when the user is gazing at a group in the scene
		this._leftPointInfo = null			// The pointing data when the user is left pointing at a group
		this._rightPointInfo = null			// The pointing data when the user is right pointing at a group
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

	get templateUUID() { return this._templateUUID }

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

	handleAvatarInfo(group){
		this._avatarGroup = group
	}
	get avatarGroup() { return this._avatarGroup }

	get leftHandGroup(){ return this.findChildByName('left_hand', this._avatarGroup) }

	get rightHandGroup(){ return this.findChildByName('right_hand', this._avatarGroup) }

	get headGroup(){ return this.findChildByName('head', this._avatarGroup) }

	get torsoGroup(){ return this.findChildByName('torso', this._avatarGroup) }

	handleInputActionStarted(action){
		this._activeActions.add(action.name)
	}
	handleInputActionEnded(action){
		this._activeActions.delete(action.name)
	}
	actionIsActive(actionName){
		return this._activeActions.has(actionName)
	}

	handleGroupInfo(group){
		this._groups.set(group.id, group) // Update with the newer info
	}
	handleGroupAdded(group){
		this._groups.set(group.id, group)
	}
	handleGroupRemoved(groupId){
		this._groups.delete(groupId)
	}
	handleGroupSettingsChanged(groupId, changedKeys, settings){
		if(this._groups.has(groupId) === false) return
		this._groups.get(groupId).settings = settings
	}
	getGroup(groupId){
		return this._groups.get(groupId) || null
	}

	handleTemplateGroupAdded(group){
		this._templateGroups.set(group.id, group)
	}
	handleTemplateGroupRemoved(groupId){
		this._templateGroups.delete(groupId)
	}
	handleTemplateGroupSettingsChanged(groupId, changedKeys, settings){
		if(this._templateGroups.has(groupId) === false){
			console.error('tried to update settings for an unknown template group', groupId, changedKeys, settings)
			return
		}
		this._templateGroups.get(groupId).settings = settings
	}
	getTemplateGroup(groupId){
		return this._templateGroups.get(groupId) || null
	}

	get templateGroups(){ return this._templateGroups.values() }

	handlePointIntersect(data){
		switch(data.pointer){
			case 'gaze':
				if(typeof data.group === 'undefined' || data.group === null || data.group.templateUUID !== this._templateUUID){
					this._gazePointInfo = null
				} else {
					this._gazePointInfo = data
				}
				break
			case 'left':
				if(typeof data.group === 'undefined' || data.group === null || data.group.templateUUID !== this._templateUUID){
					this._leftPointInfo = null
				} else {
					this._leftPointInfo = data
				}
				break
			case 'right':
				if(typeof data.group === 'undefined' || data.group === null || data.group.templateUUID !== this._templateUUID){
					this._rightPointInfo = null
				} else {
					this._rightPointInfo = data
				}
				break
			default:
				return
		}
	}
	get gazePointInfo(){ return this._gazePointInfo }
	get leftPointInfo(){ return this._leftPointInfo }
	get rightPointInfo(){ return this._rightPointInfo }
}

/*
InteractiveTemplateWorker listens for when the user points and presses or triggers.

If the user points and presses, then the group's setting 'pressed' is set to 'true'. 
On press end, the setting 'pressed' is set to 'false'. Override handleGroupSettingsChanged
to receive notice of when the settings change.

If draggable=true is passed to the constructor, when the group is pointed and triggered
it will follow the pointing group, which will be the user's head (via gaze), left hand, or right hand.

constructor params:
	draggable: if true, which this group is pointed and and triggered it will follow the appropriate gaze, left hand, or right hand. 
*/
spaciblo.client.InteractiveTemplateWorker = class extends spaciblo.client.TrackingTemplateWorker {
	constructor(draggable=true){
		super(true, true, true, true)
		this._draggable = draggable

		// These track which groups are being pointed at when a press begins: { group, intersect }
		this._pressedGazeInfo = null
		this._pressedLeftInfo = null
		this._pressedRightInfo = null

		// These track which groups are being pointed at when a trigger (and thus a follow) begin
		this._followingGaze = null
		this._followingLeft = null
		this._followingRight = null
	}

	handleTriggerStarted(group, pointer){
		// Start following the gazing group
		switch(pointer){
			case 'gaze':
				this._followingGaze = group
				postMessage(new spaciblo.client.FollowGroupMessage({
					followerId: group.id,
					leaderId: this.headGroup.id
				}))
				break
			case 'left':
				this._followingLeft = group
				postMessage(new spaciblo.client.FollowGroupMessage({
					followerId: group.id,
					leaderId: this.leftHandGroup.id
				}))
				break
			case 'right':
				this._followingRight = group
				postMessage(new spaciblo.client.FollowGroupMessage({
					followerId: group.id,
					leaderId: this.rightHandGroup.id
				}))
				break
		}
	}
	handleTriggerEnded(pointer){
		// Stop following the gazing group
		switch(pointer){
			case 'gaze':
				if(this._followingGaze === null) return
				postMessage(new spaciblo.client.FollowGroupMessage({
					followerId: this._followingGaze.id,
					leaderId: null
				}))
				this._followingGaze = null
				break
			case 'left':
				if(this._followingLeft === null) return
				postMessage(new spaciblo.client.FollowGroupMessage({
					followerId: this._followingLeft.id,
					leaderId: null
				}))
				this._followingLeft = null
				break
			case 'right':
				if(this._followingRight === null) return
				postMessage(new spaciblo.client.FollowGroupMessage({
					followerId: this._followingRight.id,
					leaderId: null
				}))
				this._followingRight = null
				break
		}
	}

	handlePressStarted(group, pointer, intersect){
		switch(pointer){
			case 'gaze':
				this._pressedGazeInfo = { group: group, intersect: intersect }
				break
			case 'left':
				this._pressedLeftInfo = { group: group, intersect: intersect }
				break
			case 'right':
				this._pressedRightInfo = { group: group, intersect: intersect }
				break
		}
		postMessage(new spaciblo.client.RequestGroupSettingsChangeMessage({
			groupId: group.id,
			settings: {
				pressed: 'true'
			}
		}))
	}
	handlePressEnded(pointer){
		let pressedGroupInfo = null
		switch(pointer){
			case 'gaze':
				pressedGroupInfo = this._pressedGazeInfo
				this._pressedGaze = null
				break
			case 'left':
				pressedGroupInfo = this._pressedLeftInfo
				this._pressedLeft = null
				break
			case 'right':
				pressedGroupInfo = this._pressedRightInfo
				this._pressedRight = null
				break
		}
		if(pressedGroupInfo === null) return
		postMessage(new spaciblo.client.RequestGroupSettingsChangeMessage({
			groupId: pressedGroupInfo.group.id,
			settings: {
				pressed: 'false'
			}
		}))
	}
	handleInputActionStarted(action){
		super.handleInputActionStarted(action)
		switch(action.name){
			case 'press':
				if(this.actionIsActive('point') && this.gazePointInfo !== null){
					this.handlePressStarted(this.gazePointInfo.group, 'gaze', this.gazePointInfo.intersect)
				}
				break
			case 'left-press':
				if(this.actionIsActive('left-point') && this.leftPointInfo !== null){
					this.handlePressStarted(this.leftPointInfo.group, 'left', this.leftPointInfo.intersect)
				}
				break
			case 'right-press':
				if(this.actionIsActive('right-point') && this.rightPointInfo !== null){
					this.handlePressStarted(this.rightPointInfo.group, 'right', this.rightPointInfo.intersect)
				}
				break
		}
		switch(action.name){
			case 'trigger':
				if(this.actionIsActive('point') && this.gazePointInfo !== null){
					this.handleTriggerStarted(this.gazePointInfo.group, 'gaze', this.gazePointInfo.intersect)
				}
				break
			case 'left-trigger':
				if(this.actionIsActive('left-point') && this.leftPointInfo !== null){
					this.handleTriggerStarted(this.leftPointInfo.group, 'left', this.leftPointInfo.intersect)
				}
				break
			case 'right-trigger':
				if(this.actionIsActive('right-point') && this.rightPointInfo !== null){
					this.handleTriggerStarted(this.rightPointInfo.group, 'right', this.rightPointInfo.intersect)
				}
				break
		}
	}
	handleInputActionEnded(action){
		super.handleInputActionEnded(action)
		switch(action.name){
			case 'press':
				this.handlePressEnded('gaze')
				break
			case 'left-press':
				this.handlePressEnded('left')
				break
			case 'right-press':
				this.handlePressEnded('right')
				break
		}
		switch(action.name){
			case 'trigger':
				this.handleTriggerEnded('gaze')
				break
			case 'left-trigger':
				this.handleTriggerEnded('left')
				break
			case 'right-trigger':
				this.handleTriggerEnded('right')
				break
		}
	}
}

/*
Tracks input events and handles locomotion for the local avatar using keyboard input (e.g. wasm or arrow keys) and teleportation via point and trigger.
*/
spaciblo.client.LocomotionTemplateWorker = class extends spaciblo.client.TrackingTemplateWorker {
	constructor(handleMotion=true, handleTeleportation=true){
		super(true, true, false, true)
		this._handleMotion = handleMotion
		this._handleTeleportation = handleTeleportation

		this._keyboardTranslationDelta = 1.9 // Meters per second
		this._keyboardRotationDelta = 1.2 // Radians per second

		this._touchTranslationDelta = 2.5 // Meters per second
		this._touchRotationDelta = 1.8 // Radians per second

		// When the user input indicates they want to rotate or translate, these are non zero
		this._inputRotation =    [0,0,0]
		this._inputTranslation = [0,0,0] // xyz translation in camera direction
	}
	handleInputActionStarted(action){
		super.handleInputActionStarted(action)
		switch(action.name){
			case 'rotate-left':
			case 'rotate-right':
			case 'rotate-up':
			case 'rotate-down':
			case 'roll-left':
			case 'roll-right':
			case 'translate-forward':
			case 'translate-backward':
			case 'translate-left':
			case 'translate-right':
			case 'translate-up':
			case 'translate-down':
				if(this._handleMotion === false) break
				if(this._updateVectors()){
					this._sendAvatarUpdate()
				}
				break
			case 'press':
				if(this._handleTeleportation === false) break
				if(this.gazePointInfo && this.actionIsActive('point') && this.actionIsActive('trigger') === false){
					this._sendTeleport('gaze')
				}
				break
			case 'left-press':
				if(this._handleTeleportation === false) break
				if(this.leftPointInfo && this.actionIsActive('left-point') && this.actionIsActive('trigger') === false){
					this._sendTeleport('left')
				}
				break
			case 'right-press':
				if(this._handleTeleportation === false) break
				if(this.rightPointInfo && this.actionIsActive('right-point') && this.actionIsActive('trigger') === false){
					this._sendTeleport('right')
				}
				break
		}
	}
	handleInputActionEnded(action){
		super.handleInputActionEnded(action)
		if(this._handleMotion && this._updateVectors()){
			this._sendAvatarUpdate()
		}
	}
	_sendTeleport(pointer){
		if(this.avatarGroup === null) return // No known local avatar group
		postMessage(new spaciblo.client.TeleportAvatarMessage({
			pointer: pointer
		}))
	}
	_sendAvatarUpdate(){
		if(this.avatarGroup === null) return // No known local avatar group
		postMessage(new spaciblo.client.UpdateAvatarMessage({
			rotation: this._inputRotation,
			translation: this._inputTranslation
		}))
	}
	// Returns true if the rotation or translation changed
	_updateVectors(){
		let oldRotation = [...this._inputRotation]
		let oldTranslation = [...this._inputTranslation]
		if(this.actionIsActive('rotate-left')){
			this._inputRotation[0] = 0
			this._inputRotation[1] = this._keyboardRotationDelta
			this._inputRotation[2] = 0
		} else if(this.actionIsActive('rotate-right')){
			this._inputRotation[0] = 0
			this._inputRotation[1] = -1 * this._keyboardRotationDelta
			this._inputRotation[2] = 0
		} else {
			this._inputRotation[0] = 0
			this._inputRotation[1] = 0
			this._inputRotation[2] = 0
		}

		if(this.actionIsActive('rotate-down')){
			this._inputRotation[0] = -1 * this._keyboardRotationDelta
		} else if(this.actionIsActive('rotate-up')){
			this._inputRotation[0] = 1 * this._keyboardRotationDelta
		}

		if(this.actionIsActive('roll-left')){
			this._inputRotation[2] = 1 * this._keyboardRotationDelta
		} else if(this.actionIsActive('roll-right')){
			this._inputRotation[2] = -1 * this._keyboardRotationDelta
		}

		if(this.actionIsActive('translate-forward')){
			this._inputTranslation[0] = 0
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = -1 * this._keyboardTranslationDelta
		} else if(this.actionIsActive('translate-backward')){
			this._inputTranslation[0] = 0
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = this._keyboardTranslationDelta
		} else if(this.actionIsActive('translate-left')){
			this._inputTranslation[0] = this._keyboardTranslationDelta
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = 0
		} else if(this.actionIsActive('translate-right')){
			this._inputTranslation[0] = -1 * this._keyboardTranslationDelta
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = 0
		} else if(this.actionIsActive('translate-up')){
			this._inputTranslation[0] = 0
			this._inputTranslation[1] = 1 * this._keyboardTranslationDelta
			this._inputTranslation[2] = 0
		} else if(this.actionIsActive('translate-down')){
			this._inputTranslation[0] = 0
			this._inputTranslation[1] = -1 * this._keyboardTranslationDelta
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
Sent by the client worker to modify selected groups using vms (see spaciblo-vms.js)
values:
	selectors: an array of vms.Selector representations
	modifiers: an array of vms.Modifier representations
*/
spaciblo.client.GroupModificationMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('group-modification', values)
		// Assume that the values passed in are unmarshalled vms values, so marshal them for transport 
		if(this.selectors) this.selectors = values.selectors.map(selector => { return selector.marshal() })
		if(this.modifiers) this.modifiers = values.modifiers.map(modifier => { return modifier.marshal() })
	}
}

/*
Sent by the client worker to create a group in the scene graph
values:
	parentId: int
optional values with defaults:
	settings: {} string:string pairs
	position: [0,0,0] 
	orientation: [0,0,0,1]
	rotation: [0,0,0]
	translation: [0,0,0]
	scale: [1,1,1]
*/
spaciblo.client.CreateGroupMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('create-group', values)
		if(!this.position) this.position = [0,0,0]
		if(!this.orientation) this.orientation = [0,0,0,1]
		if(!this.rotation) this.rotation = [0,0,0]
		if(!this.translation) this.translation = [0,0,0]
		if(!this.scale) this.scale = [1,1,1]
		if(typeof this.settings !== 'object'){
			this.settings = {}
		} else {
			// ensure that all settings have string values because that is the only supported setting type
			for(let key of Object.keys(this.settings)){
				this.settings[key] = String(this.settings[key])
			}
		}
	}
}

/*
Sent by the client worker to request that a group's settings be changed
values:
	groupId: int
	settings: { keyName: string }
*/
spaciblo.client.RequestGroupSettingsChangeMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('request-group-settings-change', values)
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
Sent by the client worker to fetch a group's information
values:
	id: the target group's id 
*/
spaciblo.client.QueryGroupMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('query-group', values)
	}
}

/*
A response to a QueryGroupMessage
values:
	group: a dict representing the scene graph of the group
*/
spaciblo.client.GroupInfoMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('group-info', values)
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
Sent when the worker wants one group (the follower) to maintain its PORTS relative to another group (the leader).
If the leader id is null, following is stopped and the follower remains at the new PORTS.
Can be used for grabbing and moving actions when the leader is a hand or gaze group.
values:
	followerId: group id int
	leaderId: group id int or null to stop following
*/
spaciblo.client.FollowGroupMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('follow-group', values)
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
	intersect: {
		distance: float,
		point: [x, y, z],
		object: group that the ray cast hit (usually different than the template group),
		face: {
			a: float,
			b: float,
			c: float,
			normal: [x, y, z]
		}
	}
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
Sent to the client when any group is removed from the scene, regardless of its template
values:
	groupId: int
*/
spaciblo.client.GroupRemovedMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('group-removed', values)
	}
}

/*
Sent to the client when any group's settings change, not including when they are first set
values:
	changedKeys: [keyName, ...]
	settings: { keyName: string, ...}
*/
spaciblo.client.GroupSettingsChangedMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('group-settings-changed', values)
	}
}

/*
Sent to the client when a group using this worker's template has settings change, not including when they are first set
values:
	changedKeys: [keyName, ...]
	settings: { keyName: string, ...}
*/
spaciblo.client.TemplateGroupSettingsChangedMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('template-group-settings-changed', values)
	}
}


/*
Fired when any group is removed from the scene, regardless of its template
values:
	groupId: int
*/
spaciblo.client.GroupRemovedMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('group-removed', values)
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
	groupId: int
*/
spaciblo.client.TemplateGroupRemovedMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('template-group-removed', values)
	}
}

// TODO switch this to an input action event
spaciblo.client.GroupClickedMessage = class extends spaciblo.client.Message {
	constructor(values={}){
		super('group-clicked', values)
	}
}
