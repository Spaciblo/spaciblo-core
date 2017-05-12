"use string";
/*
Client side scripts for templates.
*/
var spaciblo = spaciblo || {}
spaciblo.workers = spaciblo.workers || {}
spaciblo.events = spaciblo.events || {}

spaciblo.events.WorkerRequestedPORTSChange = 'worker-requested-ports-change'

/*
For each template (not instance), a single web worker is created.
Each instance of the template in the scene uses the same web worker for its client side logic.
*/
spaciblo.workers.TemplateWorker = k.eventMixin(class {
	/*
	TODO Add more input events for workers:
	- start pointing at
	- pointer motion
	- stop pointing at
	- start gazing at
	- gaze motion
	- stop gazing at
	- controller enter
	- controller move within
	- controller exit
	- avatar enter
	- avatar move within
	- avatar exit
	...
	*/
	constructor(template, manager){
		this.template = template
		this.manager = manager
		this.worker = null
		this.groups = new Map() // id -> spaciblo.three.Group
		if(!this.template.clientScriptURL()){
			// Template has no client script, so do nothing
			return
		}
		this.worker = new Worker(this.template.clientScriptURL())
		this.worker.onmessage = this.handleWorkerMessage.bind(this)
		this.worker.onerror = this.handleWorkerError.bind(this)
		this.worker.postMessage(new spaciblo.client.InitMessage())
	}
	handleGroupClicked(group){
		if(this.worker === null) return
		/*
		TODO Figure out what we really want to send here.
		How does the worker find meshes within the template?
		How does the worker query and change textures, materials, etc? 
		How does the worker query and change things other than its own group?
		*/
		this.worker.postMessage(new spaciblo.client.GroupClickedMessage({
			id: group.state.id,
			position: [group.position.x, group.position.y, group.position.z],
			orientation: [group.quaternion.x, group.quaternion.y, group.quaternion.z, group.quaternion.w],
			rotation: [group.rotationMotion.x, group.rotationMotion.y, group.rotationMotion.z],
			translation: [group.translationMotion.x, group.translationMotion.y, group.translationMotion.z],
			scale: [group.scale.x, group.scale.y, group.scale.z]
		}))
	}
	handleGroupAdded(group){
		if(this.groups.has(group.state.id)) return
		this.groups.set(group.state.id, group)
		if(this.worker === null) return
		this.worker.postMessage(new spaciblo.client.GroupAddedMessage({ id: group.state.id }))
	}
	handleGroupRemoved(group){
		if(this.groups.has(group.state.id) === false) return
		this.groups.delete(group.state.id)
		if(this.worker === null) return
		this.worker.postMessage(new spaciblo.client.GroupRemovedMessage({ id: group.state.id }))
	}
	handleWorkerError(ev){
		console.error(ev)
	}
	handleWorkerMessage(ev){
		const data = ev.data
		switch(data.name){
			case 'change-ports':
				this.manager.trigger(spaciblo.events.WorkerRequestedPORTSChange, data)
				break
			default:
				console.error('Unknown message from worker', data)
		}
	}
})

/*
Manager keeps track of exactly one TemplateWorker per template type.
*/
spaciblo.workers.Manager = k.eventMixin(class {
	constructor(){
		this.templateWorkers = new Map() // template uuid -> TemplateWorker
	}
	getTemplateWorker(templateUUID){
		return this.templateWorkers.get(templateUUID)
	}
	getOrCreateTemplateWorker(template){
		let worker = this.templateWorkers.get(template.get('uuid'))
		if(worker) return worker
		worker = new spaciblo.workers.TemplateWorker(template, this)
		this.templateWorkers.set(template.get('uuid'), worker)
		return worker
	}
})