"use strict";

importScripts('/js/spaciblo-vms.js')
importScripts('/js/spaciblo-client.js')

/*
A four integer digital clock
*/
let DigitalClockWorker = class extends spaciblo.client.InteractiveTemplateWorker {
	constructor(){
		super()
		this._savedDigits = new Map() // groupId -> [(0 - 2), (0 - 9), (0 - 9), (0 - 9)] (one for each clock digit)
		this._onModifiers =  [ vms.modifyProperty('visible', true, false) ]
		this._offModifiers = [ vms.modifyProperty('visible', false, false) ]
		this._tick()
	}

	handleTemplateGroupAdded(group){
		super.handleTemplateGroupAdded(group)
		this._initializeGroup(group.id)
	}

	// Turn off all of the digits except 0 in the group
	_initializeGroup(groupId){
		// group names are like h01 (first hour digit, numeral 1) or m14 (second minute digit, numberal 4)
		let selectors = []
		for(let digit=0; digit < 4; digit++){
			let letter = digit < 2 ? 'h' : 'm'
			let middleNum = digit < 2 ? digit : digit - 2
			for(let num=1; num < 10; num++){
				selectors.push(vms.selectProperty('name', letter + middleNum + '' + num).childOf(vms.selectId(groupId), 2))
			}
		}
		postMessage(new spaciblo.client.GroupModificationMessage({
			selectors: selectors,
			modifiers: this._offModifiers
		}))
	}

	// Called periodically to update the digits in all of this template's groups
	_tick(){
		setTimeout(this._tick.bind(this), 1000 * 5)

		// These will hold all of the selectors for sub groups in the template group that need to be modified
		let onSelectors = []
		let offSelectors = []

		let date = new Date() // Everyone will update to this time
		// Collect selectors for all of the sub template objects that need to be set visible or invisible
		for(let group of this.templateGroups){
			this._tickGroup(group.id, date, onSelectors, offSelectors)
		}

		// Now send two messages with the vms requests
		if(offSelectors.length > 0){
			postMessage(new spaciblo.client.GroupModificationMessage({
				selectors: offSelectors,
				modifiers: this._offModifiers
			}))
		}
		if(onSelectors.length > 0){
			postMessage(new spaciblo.client.GroupModificationMessage({
				selectors: onSelectors,
				modifiers: this._onModifiers
			}))
		}
	}

	// Appends selectors to onSelectors and offSelectors for the digits that need to be changed
	_tickGroup(groupId, date, onSelectors, offSelectors){
		let newDigits = this._getTimeDigits(date)
		let lastDigits = this._savedDigits.get(groupId) || [0, 0, 0, 0]

		// group names are like h01 (first hour digit, numeral 1) or m14 (second minute digit, numberal 4)
		for(let i=0; i < 4; i++){
			let letter = i < 2 ? 'h' : 'm'
			let num = i < 2 ? i : i - 2
			if(lastDigits[i] != newDigits[i]){
				onSelectors.push(vms.selectProperty('name', letter + num + '' + newDigits[i]).childOf(vms.selectId(groupId), 2))
				offSelectors.push(vms.selectProperty('name', letter + num + '' + lastDigits[i]).childOf(vms.selectId(groupId), 2))
			}
		}

		this._savedDigits.set(groupId, newDigits)
	}

	_getTimeDigits(date){
		/*
		Returns an array of four integers (0 - 9) that represent the 24 hour time for the date parameter.
		If date's time is 13:45, it returns [1, 3, 4, 5]
		*/
		let results = [0, 0, 0, 0]
		let hours = date.getHours()
		if(hours < 10){
			// results[0] stays 0
			results[1] = hours
		} else {
			results[0] = parseInt(hours.toString()[0])
			results[1] = parseInt(hours.toString()[1])
		}
		let minutes = date.getMinutes()
		if(minutes < 10){
			// results[2] stays 0
			results[3] = minutes
		} else {
			results[2] = parseInt(minutes.toString()[0])
			results[3] = parseInt(minutes.toString()[1])
		}
		return results
	}
}
new DigitalClockWorker()