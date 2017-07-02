"use strict";
importScripts('/js/spaciblo-vms.js')
importScripts('/js/spaciblo-client.js')

// We need these so that we can talk to the Spaciblo REST API for templates
importScripts('/js/potassium.js')
importScripts('/js/be-api.js')
importScripts('/js/spaciblo-api-rest.js')

/*
A cube, sphere, and cone that when clicked create more cubes, spheres, and cones. 
*/
let PenroseTilerWorker = class extends spaciblo.client.InteractiveTemplateWorker {
	constructor(){
		super()
		this._templates = null
		this._dartTemplate = null
		this._kiteTemplate = null

		this._defaultLightColor = { r: 1, g: 1, b: 1 }
		this._defaultLightIntensity = 1
		this._defaultLightTarget = [0, -1, 0]
		this._lightColors = [
			{ r: 1, g: 1, b: 1 },
			{ r: 0, g: 0, b: 0 },
			{ r: 0, g: 0, b: 1 },
			{ r: 0, g: 1, b: 0 },
			{ r: 0, g: 1, b: 1 },

			{ r: 1, g: 0, b: 0 },
			{ r: 1, g: 0, b: 1 },
			{ r: 1, g: 1, b: 0 },
			// And a few spares for custom colors
			{ r: 0.5, g: 0.5, b: 0.5 },
			{ r: 0.5, g: 0.5, b: 0.5 }
		]
		this._saturationCount = 5
		this._saturationTop = 0.8 // most saturated offered
		this._saturationBottom = 0.2 // least saturated offered
		this._saturationColors = null // Set in _updateFromSettings
	}

	handleSchemaPopulated(){
		this._templates = new be.api.Templates()
		this._templates.fetch().then(() => {
			this._setupTemplates()
		}).catch((...params) => {
			console.error('error', ...params)
		})
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

		if(!group.settings['color']){
			this._changeSettings(group.id, { 'color': rgbToHex(this._defaultLightColor) })
		}
	}

	handleTemplateGroupSettingsChanged(groupId, changedKeys, settings) {
		super.handleTemplateGroupSettingsChanged(groupId, changedKeys, settings)
		if(changedKeys.includes('color')){
			this._updateFromSettings(this.getTemplateGroup(groupId))
		}
	}

	handlePressStarted(group, pointer, intersect){
		super.handlePressStarted(group, pointer, intersect)
		if(this._templates === null || this._templates.length === 0){
			console.error('Still fetching the templates')
			return
		}

		// Handle color changes
		if(intersect.object.name.startsWith('Color')){
			var index = parseInt(intersect.object.name[intersect.object.name.length - 1])
			var settings = {
				'color': rgbToHex(this._lightColors[index])
			}
			this._changeSettings(group.id, settings)
			return
		} else if(intersect.object.name.startsWith('Saturation')){
			var index = parseInt(intersect.object.name[intersect.object.name.length - 1])
			var settings = {
				'color': rgbToHex(this._saturationColors[index])
			}
			this._changeSettings(group.id, settings)
			return
		}

		let template = null
		let name = null
		let x = 0
		switch(intersect.object.name){
			case 'Dart':
				template = this._dartTemplate
				name = 'Dart '
				x = 0.15
				break
			case 'Kite':
				template = this._kiteTemplate
				name = 'Kite '
				x = -0.15
				break
			default:
				console.log('unknown intersect', intersect)
				return
		}
		name += Math.random() * 1000
		postMessage(new spaciblo.client.CreateGroupMessage({
			parentId: group.id,
			settings: {
				name: name,
				templateUUID: template.get('uuid'),
				color: rgbToHex(this._getGroupColor(group))
			},
			position: [x, 0.5, 0]
		}))
	}

	_setupTemplates(){
		this._dartTemplate = this._templates.dataObjects.find(template => { return template.get('name') === 'Penrose Dart' }) || null
		this._kiteTemplate = this._templates.dataObjects.find(template => { return template.get('name') === 'Penrose Kite' }) || null
		if(!this._dartTemplate || !this._kitTemplate){
			console.error('Could not find one of the prim templates', this._dartTemplate, this._kiteTemplate)
		}
	}

	_changeSettings(groupId, settings){
		postMessage(new spaciblo.client.RequestGroupSettingsChangeMessage({
			groupId: groupId,
			settings: settings
		}))
	}

	_getGroupColor(group){
		if(group.settings['color']){
			var color = hexToRGB(group.settings['color'])
			if(color === null) color = this._defaultLightColor
		} else {
			var color = this._defaultLightColor
		}
		return color
	}

	_updateFromSettings(group){
		var color = this._getGroupColor(group)
		postMessage(new spaciblo.client.GroupModificationMessage({
			selectors: [
				vms.selectProperty('name', 'Dart').childOf(vms.selectId(group.id), 2),
				vms.selectProperty('name', 'Kite').childOf(vms.selectId(group.id), 2)
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
}
new PenroseTilerWorker()

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
