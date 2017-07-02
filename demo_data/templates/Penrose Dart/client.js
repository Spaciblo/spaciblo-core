"use strict";
importScripts('/js/spaciblo-vms.js')
importScripts('/js/spaciblo-client.js')

let shapeName = 'Dart'

let ShapeWorker = class extends spaciblo.client.InteractiveTemplateWorker {
	// When a group using this template arrives, set it according to its settings
	handleTemplateGroupAdded(group){
		super.handleTemplateGroupAdded(group)
		if(group.settings && group.settings.color){
			postMessage(new spaciblo.client.GroupModificationMessage({
				selectors: [
					vms.selectProperty('name', shapeName).childOf(vms.selectId(group.id), 2)
				],
				modifiers: [
					vms.modifyProperty('material.color', hexToRGB(group.settings.color), true)
				]
			}))
		}
	}
}
new ShapeWorker()

// 'f' or 'ff' to 1.0
function colorHexToFloat(h){
	return parseInt(h, 16) / 255	
}

// '#ffffff' or '#fff' to { r: 1.0, g: 1.0, b: 1.0 }
function hexToRGB(hex){
	if(hex.startsWith('#')) hex = hex.substring(1)
	if(hex.length === 3){
		var r = colorHexToFloat(hex[0])
		var g = colorHexToFloat(hex[1])
		var b = colorHexToFloat(hex[2])
	} else if(hex.length === 6){
		var r = colorHexToFloat(hex.substring(0, 2))
		var g = colorHexToFloat(hex.substring(2, 4))
		var b = colorHexToFloat(hex.substring(4, 6))
	} else {
		console.error('bad hex', hex)
		return null
	}
	return { r: r, g: g, b: b }
}
