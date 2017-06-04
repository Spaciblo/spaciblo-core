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
let PrimitivesWorker = class extends spaciblo.client.InteractiveTemplateWorker {
	constructor(){
		super()
		this._templates = null
		this._cubeTemplate = null
		this._sphereTemplate = null
		this._coneTemplate = null
	}
	handleSchemaPopulated(){
		this._templates = new be.api.Templates()
		this._templates.fetch().then(() => {
			this._setupTemplates()
		}).catch((...params) => {
			console.error('error', ...params)
		})
	}
	_setupTemplates(){
		this._cubeTemplate = this._templates.dataObjects.find(template => { return template.get('name') === 'Cube' }) || null
		this._sphereTemplate = this._templates.dataObjects.find(template => { return template.get('name') === 'Sphere' }) || null
		this._coneTemplate = this._templates.dataObjects.find(template => { return template.get('name') === 'Cone' }) || null
		if(!this._cubeTemplate || !this._sphereTemplate || !this._coneTemplate){
			console.error('Could not find one of the prim templates')
		}
	}
	handlePressStarted(group, pointer, intersect){
		super.handlePressStarted(group, pointer, intersect)
		if(this._templates === null || this._templates.length === 0){
			console.error('Still fetching the templates')
			return
		}

		let template = null
		let name = null
		switch(intersect.object.name){
			case 'Cube':
				template = this._cubeTemplate
				name = 'Cube '
				break
			case 'Sphere':
				template = this._sphereTemplate
				name = 'Sphere '
				break
			case 'Cone':
				template = this._coneTemplate
				name = 'Cone '
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
				templateUUID: template.get('uuid')
			},
			position: [0, 0.2 + (Math.random() * 0.5), 0]
		}))
	}
}
self.worker = new PrimitivesWorker()
