"use strict";
importScripts('/js/spaciblo-vms.js')
importScripts('/js/spaciblo-client.js')

/*
A push button
*/
let ButtonWorker = class extends spaciblo.client.PressableTemplateWorker {
	constructor(){
		super()
		this._followingGaze = null
		this._followingLeft = null
		this._followingRight = null

		this._pressedColor = { r: 0, g: 1, b: 0 }
		this._initialColor = { r: 1, g: 1, b: 1 }
	}

	// These turn the button green when the pressed settings is changed by the PressableTemplateWorker ancestor
	handleTemplateGeometryLoaded(group){
		this._setPressed(group.id, group.settings && group.settings['pressed'] === 'true')
	}
	handleTemplateGroupSettingsChanged(groupId, changedKeys, settings){
		super.handleTemplateGroupSettingsChanged(groupId, changedKeys, settings)
		if(changedKeys.includes('pressed') === false) return
		this._setPressed(groupId, settings['pressed'] === 'true')
	}
	_setPressed(groupId, pressed){
		postMessage(new spaciblo.client.GroupModificationMessage({
			selectors: [
				vms.selectProperty('name', 'Button_Cube.001').childOf(vms.selectId(groupId))
			],
			modifiers: [
				vms.modifyProperty('material.color', pressed ? this._pressedColor : this._initialColor)
			]
		}))

	}

	// These allow the button to be dragged. TODO make this a generic capability that scripts can just mix in.
	handleTriggerStarted(group, pointer){
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
}
let buttonWorker = new ButtonWorker()
