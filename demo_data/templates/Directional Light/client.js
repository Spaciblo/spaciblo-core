"use strict";
importScripts('/js/spaciblo-vms.js')
importScripts('/js/spaciblo-client.js')

// 1.0 to 'ff'
function colorFloatToHex(f){
	let result = Math.ceil(255 * f).toString(16).padStart(2, '0')
	return result
}
// 'f' or 'ff' to 1.0
function colorHexToFloat(h){
	return parseInt(h, 16) / 255	
}
// { r: 1.0, g: 1.0, b: 1.0 } to '#ffffff'
function rgbToHex(rgb){
	return '#' + colorFloatToHex(rgb.r) + colorFloatToHex(rgb.g) + colorFloatToHex(rgb.b)
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


/*
A template for adjusting the directional light within a space
*/
let DirectionalLightWorker = class extends spaciblo.client.InteractiveTemplateWorker {
	constructor(){
		super()
		this._defaultLightColor = { r: 1, g: 1, b: 1 }
		this._defaultLightIntensity = 1
		this._defaultLightTarget = [0, -1, 0]
		this._lightSettings = ['light-type', 'light-color', 'light-intensity', 'light-target']
		this._lightColors = [
			{ r: 1, g: 1, b: 1 },
			{ r: 0, g: 0, b: 1 },
			{ r: 0, g: 1, b: 0 },
			{ r: 0, g: 1, b: 1 },
			{ r: 1, g: 0, b: 0 },

			{ r: 1, g: 0, b: 1 },
			{ r: 1, g: 1, b: 0 },
			// And a few spares for custom colors
			{ r: 0.5, g: 0.5, b: 0.5 },
			{ r: 0.5, g: 0.5, b: 0.5 },
			{ r: 0.5, g: 0.5, b: 0.5 }
		]
		this._saturationCount = 5
		this._saturationTop = 0.8 // most saturated offered
		this._saturationBottom = 0.2 // least saturated offered
		this._saturationColors = null // Set in _updateFromSettings
		this._intensityCount = 10
		this._maxIntensity = 2
		this._lightIntensities = []
		for(let i=0; i < this._intensityCount; i++){
			this._lightIntensities[this._intensityCount - 1 - i] = i * (this._maxIntensity / (this._intensityCount - 1))
		}
	}

	// When a group using this template arrives, set it according to its settings
	handleTemplateGroupAdded(group){
		super.handleTemplateGroupAdded(group)

		// Initialize the color buttons
		for(let i=0; i < this._lightColors.length; i++){
			postMessage(new spaciblo.client.GroupModificationMessage({
				selectors: [
					vms.selectProperty('name', 'Color' + i).childOf(vms.selectId(group.id), 2)
				],
				modifiers: [
					vms.modifyProperty('material.color', this._lightColors[i], true)
				]
			}))
		}

		// Initialize the intensity buttons
		for(let i=0; i < this._intensityCount; i++){
			let intensityColorValue = this._lightIntensities[i] / this._maxIntensity
			postMessage(new spaciblo.client.GroupModificationMessage({
				selectors: [
					vms.selectProperty('name', 'Intensity' + i).childOf(vms.selectId(group.id), 2)
				],
				modifiers: [
					vms.modifyProperty('material.color', {
						r: intensityColorValue,
						g: intensityColorValue,
						b: intensityColorValue
					}, true)
				]
			}))
		}

		// Set defaults if necessary
		if(group.settings['light-type'] != 'directional'){
			this._changeSettings(group.id, { 'light-type': 'directional' })
		}
		if(!group.settings['light-color']){
			this._changeSettings(group.id, { 'light-color': rgbToHex(this._defaultLightColor) })
		}
		if(!group.settings['light-intensity']){
			this._changeSettings(group.id, { 'light-intensity': this._defaultLightIntensity.toString(10) })
		}
		if(!group.settings['light-target']){
			this._changeSettings(group.id, { 'light-target': this._defaultLightTarget.join(',') })
		}

		this._updateFromSettings(group)
	}

	handleTemplateGroupSettingsChanged(groupId, changedKeys, settings) {
		super.handleTemplateGroupSettingsChanged(groupId, changedKeys, settings)

		// If any of the changed keys are a light setting, update from settings
		for(let changedKey of changedKeys){
			if(this._lightSettings.includes(changedKey)){
				this._updateFromSettings(this.getTemplateGroup(groupId))
				break
			}
		}
	}

	_updateFromSettings(group){
		if(group.settings['light-color']){
			var color = hexToRGB(group.settings['light-color'])
			if(color === null) color = this._defaultLightColor
		} else {
			var color = this._defaultLightColor
		}
		postMessage(new spaciblo.client.GroupModificationMessage({
			selectors: [
				vms.selectProperty('name', 'Arrow').childOf(vms.selectId(group.id), 2)
			],
			modifiers: [
				vms.modifyProperty('material.color', color, true)
			]
		}))
		this._saturationColors = this._generateSaturations(color.r, color.g, color.b)

		for(let i=0; i < this._saturationCount; i++){
			postMessage(new spaciblo.client.GroupModificationMessage({
				selectors: [
					vms.selectProperty('name', 'Saturation' + i).childOf(vms.selectId(group.id), 2)
				],
				modifiers: [
					vms.modifyProperty('material.color', {
						r: this._saturationColors[i].r,
						g: this._saturationColors[i].g,
						b: this._saturationColors[i].b
					}, true)
				]
			}))
		}
	}

	_changeSettings(groupId, settings){
		postMessage(new spaciblo.client.RequestGroupSettingsChangeMessage({
			groupId: groupId,
			settings: settings
		}))
	}

	// For the given red, green, and blue color, generate _saturationCount colors of varied saturations
	_generateSaturations(r, g, b){
		let min = Math.min(r, g, b)
		let topDelta = this._saturationTop - min // The distance of the max from fully saturated
		let step = (this._saturationTop - this._saturationBottom) / this._saturationCount
		let results = []
		for(let i=0; i < this._saturationCount; i++){
			results[i] = {
				r: Math.min(Math.max(0, r + topDelta - (i * step)), 1),
				g: Math.min(Math.max(0, g + topDelta - (i * step)), 1),
				b: Math.min(Math.max(0, b + topDelta - (i * step)), 1)
			}
		}
		return results
	}

	handlePressStarted(group, pointer, intersect){
		super.handlePressStarted(group, pointer, intersect)
		if(intersect.object.name.startsWith('Intensity')){
			var index = parseInt(intersect.object.name[intersect.object.name.length - 1])
			var settings = {
				'light-intensity': this._lightIntensities[index].toString()
			}
		} else if(intersect.object.name.startsWith('Color')){
			var index = parseInt(intersect.object.name[intersect.object.name.length - 1])
			var settings = {
				'light-color': rgbToHex(this._lightColors[index])
			}
		} else if(intersect.object.name.startsWith('Saturation')){
			var index = parseInt(intersect.object.name[intersect.object.name.length - 1])
			var settings = {
				'light-color': rgbToHex(this._saturationColors[index])
			}
		} else {
			return
		}
		this._changeSettings(group.id, settings)
	}
}
new DirectionalLightWorker()