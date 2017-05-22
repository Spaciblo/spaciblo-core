importScripts('/js/spaciblo-client.js')


/*
A simple input action to avatar movement client script.
*/
MyWorker = class extends spaciblo.client.TemplateWorker {
	constructor(){
		super()
		this._activeActions = new Set()
		this._avatarGroup = null

		this._keyboardTranslationDelta = 1.9 // Meters per second
		this._keyboardRotationDelta = 1.2 // Radians per second

		this._touchTranslationDelta = 2.5 // Meters per second
		this._touchRotationDelta = 1.8 // Radians per second

		// When the user input indicates they want to rotate or translate, these are non zero
		this._inputRotation =    [0,0,0]
		this._inputTranslation = [0,0,0] // xyz translation in camera direction
	}
	init(data){
		this.templateUUID == data.templateUUID
		postMessage(new spaciblo.client.QueryAvatarMessage())
		postMessage(new spaciblo.client.InputActionSubscriptionMessage({ subscribed: true }))
	}
	handleAvatarInfo(data){
		this._avatarGroup = data.group
	}
	handleInputActionStarted(event){
		this._activeActions.add(event.action.name)
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
		}
	}
	handleInputActionEnded(event){
		this._activeActions.delete(event.action.name)
		if(this._updateVectors()){
			this._sendAvatarUpdate()
		}
	}
	_sendAvatarUpdate(){
		if(this._avatarGroup === null) return // No known local avatar group
		postMessage(new spaciblo.client.UpdateAvatarMessage({
			rotation: this._inputRotation,
			translation: this._inputTranslation
		}))
	}
	_isActionActive(name){
		return this._activeActions.has(name)
	}
	// Returns true if the rotation or translation changed
	_updateVectors(){
		let oldRotation = [...this._inputRotation]
		let oldTranslation = [...this._inputTranslation]
		if(this._isActionActive('rotate-left')){
			this._inputRotation[0] = 0
			this._inputRotation[1] = this._keyboardRotationDelta
			this._inputRotation[2] = 0
		} else if(this._isActionActive('rotate-right')){
			this._inputRotation[0] = 0
			this._inputRotation[1] = -1 * this._keyboardRotationDelta
			this._inputRotation[2] = 0
		} else {
			this._inputRotation[0] = 0
			this._inputRotation[1] = 0
			this._inputRotation[2] = 0
		}
		if(this._isActionActive('translate-forward')){
			this._inputTranslation[0] = 0
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = -1 * this._keyboardTranslationDelta
		} else if(this._isActionActive('translate-backward')){
			this._inputTranslation[0] = 0
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = this._keyboardTranslationDelta
		} else if(this._isActionActive('translate-left')){
			this._inputTranslation[0] = this._keyboardTranslationDelta
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = 0
		} else if(this._isActionActive('translate-right')){
			this._inputTranslation[0] = -1 * this._keyboardTranslationDelta
			this._inputTranslation[1] = 0
			this._inputTranslation[2] = 0
		} else if(this._isActionActive('translate-up')){
			this._inputTranslation[0] = 0
			this._inputTranslation[1] = 1 * this._keyboardTranslationDelta
			this._inputTranslation[2] = 0
		} else if(this._isActionActive('translate-down')){
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
myWorker = new MyWorker()

