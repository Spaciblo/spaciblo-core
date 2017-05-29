"use strict";
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
	}

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
