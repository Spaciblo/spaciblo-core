"use strict";
importScripts('/js/spaciblo-vms.js')
importScripts('/js/spaciblo-client.js')

// We need these so that we can talk to the Spaciblo REST API for templates
importScripts('/js/potassium.js')
importScripts('/js/be-api.js')
importScripts('/js/spaciblo-api-rest.js')

const defaultImageName = 'Image-Viewer.png'
const fileNameKey = 'fileName'

const minImageSide = 0.05 // Don't allow images to be scaled below this size

/*
A template for showing a 2D image
*/
let ImageViewerWorker = class extends spaciblo.client.InteractiveTemplateWorker {
	constructor(){
		super()
	}

	handleTemplateGroupAdded(group){
		super.handleTemplateGroupAdded(group)
		if(be.api.Template){
			this._updateGroupImageFromSetting(group)	
		} else {
			setTimeout(() => { this._updateGroupImageFromSetting(group) }, 2000)
		}
	}

	handleInputActionStarted(action){
		super.handleInputActionStarted(action)
		if(['glide-y', 'left-glide-y', 'right-glide-y'].includes(action.name)){
			const gazePoint = this.firstGazePointInfo
			if(gazePoint !== null){
				this._scaleGroup(gazePoint.group.id, action.value)
			}
		}
	}

	_scaleGroup(groupId, amount){
		const group = this.getTemplateGroup(groupId)
		const scale = 1 + amount
		const newWidth = group.scale[0] * scale
		const newHeight = group.scale[1] * scale
		if(newWidth < minImageSide || newHeight < minImageSide){
			return
		}
		const newScale = [newWidth, newHeight, 1]
		postMessage(new spaciblo.client.ChangePORTSMessage(group.id, {
			scale: newScale
		}))
		setTimeout(() => { postMessage(new spaciblo.client.QueryGroupMessage({ id: groupId })) }, 200)
	}

	handleGroupSettingsChanged(groupId, changedKeys, settings){
		super.handleGroupSettingsChanged(groupId, changedKeys, settings)
		if(changedKeys.includes(fileNameKey) === false) return
		const group = this.getTemplateGroup(groupId)
		if(group === null){
			console.error('error setting unknown group', groupId, changedKeys, settings)
			return
		}
		this._updateGroupImageFromSetting(group)
	}

	_updateGroupImageFromSetting(group){
		let imageName = group.settings[fileNameKey] || defaultImageName
		let imagePath = new be.api.Template({ uuid: group.settings['templateUUID'] }).getBaseURL() + imageName
		postMessage(new spaciblo.client.GroupModificationMessage({
			selectors: [ vms.selectId(group.id) ],
			modifiers: [
				vms.modifyMaterialMap(imagePath, true, true)
			]
		}))
	}
}
new ImageViewerWorker()