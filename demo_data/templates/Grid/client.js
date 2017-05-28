"use strict";
importScripts('/js/spaciblo-client.js')

/*
A simple input action to avatar movement client script.
*/
let MyWorker = class extends spaciblo.client.TrackingTemplateWorker {
	constructor(){
		super(true, true, false, true)

		this._keyboardTranslationDelta = 1.9 // Meters per second
		this._keyboardRotationDelta = 1.2 // Radians per second

		this._touchTranslationDelta = 2.5 // Meters per second
		this._touchRotationDelta = 1.8 // Radians per second

		// When the user input indicates they want to rotate or translate, these are non zero
		this._inputRotation =    [0,0,0]
		this._inputTranslation = [0,0,0] // xyz translation in camera direction
	}
	handleInputActionStarted(event){
		super.handleInputActionStarted(event)
		switch(event.action.name){
			case 'rotate-left':
			case 'rotate-right':
			case 'translate-forward':
			case 'translate-backward':
			case 'translate-left':
			case 'translate-right':
			case 'translate-up':
			case 'translate-down':
				if(this._updateVectors()){
					this._sendAvatarUpdate()
				}
				break
			case 'press':
				if(this.actionIsActive('point') && this.gazePoint){
					this._sendTeleport('gaze')
				}
				break
			case 'left-press':
				if(this.actionIsActive('left-point') && this.leftPoint){
					console.log('left point', this.leftPoint)
					this._sendTeleport('left')
				}
				break
			case 'right-press':
				if(this.actionIsActive('right-point') && this.rightPoint){
					this._sendTeleport('right')
				}
				break
		}
	}
	handleInputActionEnded(event){
		super.handleInputActionEnded(event)
		if(this._updateVectors()){
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
let myWorker = new MyWorker()
