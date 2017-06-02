"use strict";

importScripts('/js/spaciblo-client.js')

let MyWorker = class extends spaciblo.client.InteractiveTemplateWorker {
	constructor(){
		super()
		this._isAnimatingMap = new Map() // group id -> bool
		this._halfLife = 500
		this._translationPerSecond = 0.8
		this._positionChange = (this._halfLife / 1000) * this._translationPerSecond
		this._rotationPerSecond = 12
	}

	handleTemplateGroupSettingsChanged(groupId, changedKeys, settings){
		super.handleTemplateGroupSettingsChanged(groupId, changedKeys, settings)
		if(changedKeys.includes('pressed') === false) return
		if(settings['pressed'] !== 'true') return
		this._animateGroup(groupId)
	}

	_animateGroup(groupId){
		if(this._isAnimatingMap.get(groupId) === true) return
		this._isAnimatingMap.set(groupId, true)

		var group = this.getTemplateGroup(groupId)

		postMessage(new spaciblo.client.ChangePORTSMessage(groupId, {
			translation: [0, this._translationPerSecond, 0],
			rotation: [0, this._rotationPerSecond, 0]
		}))

		setTimeout(() => {
			postMessage(new spaciblo.client.ChangePORTSMessage(groupId, {
				position: [group.position[0], group.position[1] + this._positionChange, group.position[2]],
				translation: [0, -this._translationPerSecond, 0],
				rotation: [0, -this._rotationPerSecond, 0]
			}))
		}, this._halfLife)

		setTimeout(() => {
			postMessage(new spaciblo.client.ChangePORTSMessage(groupId, {
				position: group.position,
				orientation: [0,0,0,1],
				rotation: [0,0,0],
				translation: [0,0,0],
			}))
			this._isAnimatingMap.set(groupId, false)
		}, this._halfLife * 2)
	}
}
let worker = new MyWorker()
