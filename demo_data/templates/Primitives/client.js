"use strict";
importScripts('/js/spaciblo-vms.js')
importScripts('/js/spaciblo-client.js')

/*
A cube, sphere, and cone that when clicked create more cubes, spheres, and cones. 
*/
let PrimitivesWorker = class extends spaciblo.client.InteractiveTemplateWorker {
	init(data){
		super.init(data)

	}
	handlePressStarted(group, pointer, intersect){
		super.handlePressStarted(group, pointer, intersect)
		switch(intersect.object.name){
			case 'Sphere':
				console.log('sphere')
				break
			case 'Cube':
				console.log('cube')
				break
			case 'Cone':
				console.log('cone')
				break
			default:
				console.log('unknown intersect', intersect)
		}
		// TODO find the templateUUIDs for the separate sphere, cube, and cone templates that we want to create
	}
}
let worker = new PrimitivesWorker()
