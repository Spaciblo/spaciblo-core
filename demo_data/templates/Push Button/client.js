"use strict";
importScripts('/js/spaciblo-vms.js')
importScripts('/js/spaciblo-client.js')

/*
A push button that turns green when pointed at and pressed and can be dragged around by pointing and triggering 
*/
let ButtonWorker = class extends spaciblo.client.InteractiveTemplateWorker {
	constructor(){
		super()
		this._pressedColor = { r: 0, g: 1, b: 0 }
		this._initialColor = { r: 1, g: 1, b: 1 }
	}

	// When a group's geometry arrives, set it according to its settings
	handleTemplateGeometryLoaded(group){
		super.handleTemplateGeometryLoaded(group)
		this._setPressed(group.id, group.settings && group.settings['pressed'] === 'true')
	}

	// When a group's settings change, set it accordingly 
	handleTemplateGroupSettingsChanged(groupId, changedKeys, settings){
		super.handleTemplateGroupSettingsChanged(groupId, changedKeys, settings)
		if(changedKeys.includes('pressed') === false) return
		this._setPressed(groupId, settings['pressed'] === 'true')
	}

	// Here is where we set the button to green or white, depending on whether or not it is pressed
	_setPressed(groupId, pressed){
		// Turn the button green or white
		postMessage(new spaciblo.client.GroupModificationMessage({
			selectors: [
				vms.selectProperty('name', 'Button_Cube.001').childOf(vms.selectId(groupId), 2)
			],
			modifiers: [
				vms.modifyProperty('material.color', pressed ? this._pressedColor : this._initialColor)
			]
		}))
	}
}
let buttonWorker = new ButtonWorker()
