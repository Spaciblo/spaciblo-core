"use strict";

importScripts('/js/spaciblo-vms.js')
importScripts('/js/spaciblo-client.js')

/*
A time frame is a binary clock that counts the number of seconds since the unix epoch
https://en.wikipedia.org/wiki/Unix_time
*/
let TimeFrameWorker = class extends spaciblo.client.InteractiveTemplateWorker {
	constructor(){
		super()
		this._savedTimes = new Map() // groupId -> last tick time
		this._zeroModifiers = [ vms.modifyProperty('rotation.x', 0, true) ]
		this._oneModifiers =  [ vms.modifyProperty('rotation.x', Math.PI, true) ]
		this._tick()
	}

	_tick(){
		setTimeout(this._tick.bind(this), 500)
		let zeroSelectors = []
		let oneSelectors = []

		// Collect selectors for all of the sub template objects that need to be set to zero or one
		for(let group of this.templateGroups){
			this._tickGroup(group.id, zeroSelectors, oneSelectors)
		}

		// Now send a single message for zero changes and a single message for one changes
		if(zeroSelectors.length > 0){
			postMessage(new spaciblo.client.GroupModificationMessage({
				selectors: zeroSelectors,
				modifiers: this._zeroModifiers
			}))
		}
		if(oneSelectors.length > 0){
			postMessage(new spaciblo.client.GroupModificationMessage({
				selectors: oneSelectors,
				modifiers: this._oneModifiers
			}))
		}
	}

	// Appends selectors to zeroSelectors and oneSelectors for the bars that need to be flipped.
	_tickGroup(groupId, zeroSelectors, oneSelectors){
		let startTime = new Date().getTime() / 1000 | 0
		let time = startTime
		let lastTime = this._savedTimes.get(groupId) || 0

		for(var i = 0; i < 32; i++){
			if((time & 1) == 1){
				if(lastTime == -1 || (lastTime & 1) != 1){
					// set i to 1
					oneSelectors.push(vms.selectProperty('name', 'Rod_' + i).childOf(vms.selectId(groupId), 2))
				} 
			} else {
				if(lastTime == -1 || (lastTime & 1) == 1){
					// set i to 0
					zeroSelectors.push(vms.selectProperty('name', 'Rod_' + i).childOf(vms.selectId(groupId), 2))
				}
			}
			lastTime = lastTime >> 1
			time = time >> 1
		}
		this._savedTimes.set(groupId, startTime)
	}

}
new TimeFrameWorker()