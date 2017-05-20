"use string";
/*
Client side scripts for templates.
*/
var spaciblo = spaciblo || {}
spaciblo.workers = spaciblo.workers || {}
spaciblo.events = spaciblo.events || {}

spaciblo.events.WorkerRequestedPORTSChange = 'worker-requested-ports-change'
spaciblo.events.WorkerRequestedAvatarUpdate = 'worker-requested-avatar-update'

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
	*/
	constructor(template, manager){
		this.template = template
		this.manager = manager
		this.worker = null
		this.workerIsReady = false
		this.templateGroups = new Set() // group IDs for every group using this template
		this.preloadMessageQueue = [] // Messages stored for when the worker indicates it is ready

		// Filter flags for events that the script wants to receive
		this.subscribedToInputAction = false
		this.subscribedToGroupExistence = false
		this.subscribedToTemplateGroupExistence = false

		if(this.template.isNew){
			this.template.addListener(() => {
				this._initWorker()
			}, 'fetched', true)
		} else {
			this._initWorker()
		}
	}
	terminate(){
		if(this.worker !== null){
			this.worker.terminate()
			this.worker = null
		}
	}
	_initWorker(){
		if(!this.template.clientScriptURL()){
			// Template has no client script, so do nothing
			return
		}
		this.worker = new Worker(this.template.clientScriptURL())
		this.worker.onmessage = this.handleWorkerMessage.bind(this)
		this.worker.onerror = this.handleWorkerError.bind(this)
		this.worker.postMessage(new spaciblo.client.InitMessage({
			templateName: this.template.get('name'),
			templateUUID: this.template.get('uuid')
		}))
	}
	_postMessage(message){
		if(this.worker === null) return
		if(this.workerIsReady === false){
			this.preloadMessageQueue.push(message)
			return
		}
		this.worker.postMessage(message)
	}
	handleInputActionStarted(action){
		if(this.subscribedToInputAction === false) return
		this._postMessage(new spaciblo.client.InputActionStartedMessage({
			action
		}))
	}
	handleInputActionEnded(action){
		if(this.subscribedToInputAction === false) return
		this._postMessage(new spaciblo.client.InputActionEndedMessage({
			action
		}))
	}
	handleGroupClicked(group){
		/*
		TODO Figure out what we really want to send here.
		How does the worker find meshes within the template?
		How does the worker query and change textures, materials, etc? 
		How does the worker query and change things other than its own group?
		*/
		this._postMessage(new spaciblo.client.GroupClickedMessage({
			group: group.serializeForWorker()
		}))
	}
	handleGroupAdded(group){
		if(this.subscribedToGroupExistence === false) return
		this._postMessage(new spaciblo.client.GroupAddedMessage({
			group: group.serializeForWorker()
		}))
	}
	handleGroupDeleted(groupID){
		// This is called when a group is removed from the scene graph
		if(this.worker === null) return
		if(this.subscribedToGroupExistence){
			this._postMessage(new spaciblo.client.GroupDeletedMessage({
				groupID: groupID
			}))
		}
		const isTemplateGroup = this.templateGroups.has(groupID)
		if(isTemplateGroup) this.templateGroups.delete(groupID)

		// If that was the last group using this template, terminate the worker
		if(this.templateGroups.size === 0){
			this.manager.terminateTemplateWorker(this)
			return
		}

		if(isTemplateGroup && this.subscribedToTemplateGroupExistence){
			this._postMessage(new spaciblo.client.TemplateGroupDeletedMessage({
				groupID: groupID
			}))
		}
	}
	handleTemplateUnset(groupID, templateUUID){
		// This is called when a group in the scene graph is no longer associated with a template
		if(this.templateGroups.has(groupID) === false) return
		this.templateGroups.delete(groupID)

		// If that was the last group using this template, terminate the worker
		if(this.templateGroups.size === 0){
			this.manager.terminateTemplateWorker(this)
			return
		}

		if(this.subscribedToTemplateGroupExistence){
			this._postMessage(new spaciblo.client.TemplateGroupDeletedMessage({
				groupID: groupID
			}))
		}
	}
	handleTemplateGroupAdded(group){
		this.templateGroups.add(group.state.id)
		this._postMessage(new spaciblo.client.TemplateGroupAddedMessage({
			group: group.serializeForWorker()
		}))
	}
	handleWorkerError(ev){
		console.error(ev)
		if(this.workerIsReady === false){
			// We received an error before the script sent a ready message, so abort it
			if(this.worker !== null){
				this.worker.terminate()
				this.worker = null
			}
			this.preloadMessageQueue = [] // No need to store messages for a terminated worker
		}
	}
	handleWorkerMessage(ev){
		const data = ev.data
		switch(data.name){
			case 'worker-ready':
				this.workerIsReady = true
				setTimeout(() => {
					for(let message of this.preloadMessageQueue){
						this.worker.postMessage(message)
					}
					this.preloadMessageQueue = []
				}, 500)
				break
			case 'change-ports':
				this.manager.trigger(spaciblo.events.WorkerRequestedPORTSChange, data)
				break
			case 'input-action-subscription':
				this.subscribedToInputAction = data.subscribed === true
				break
			case 'group-existence-subscription':
				this.subscribedToGroupExistence = data.subscribed === true
				break
			case 'template-group-existence-subscription':
				this.subscribedToTemplateGroupExistence = data.subscribed === true
				break
			case 'query-avatar':
				const avatarGroup = this.manager.getAvatarGroup()
				if(avatarGroup === null){
					console.error('null avatar group')
				} else {
					this.worker.postMessage(new spaciblo.client.AvatarInfoMessage({
						group: avatarGroup.serializeForWorker()
					}))
				}
				break
			case 'update-avatar':
				this.manager.trigger(spaciblo.events.WorkerRequestedAvatarUpdate, data)
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
	constructor(inputManager){
		this.inputManager = inputManager
		this.renderer = null // Will be set using this.setRenderer
		this.templateWorkers = new Map() // template uuid -> TemplateWorker

		this.inputManager.addListener((eventName, action) => {
			for(let [uuid, worker] of this.templateWorkers){
				worker.handleInputActionStarted(action)
			}
		}, spaciblo.events.InputActionStarted)
		this.inputManager.addListener((eventName, action) => {
			for(let [uuid, worker] of this.templateWorkers){
				worker.handleInputActionEnded(action)
			}
		}, spaciblo.events.InputActionEnded)
	}
	setRenderer(renderer){
		this.renderer = renderer
	}
	handleGroupAdded(group){
		for(let [uuid, worker] of this.templateWorkers){
			worker.handleGroupAdded(group)
		}
	}
	handleGroupDeleted(groupID){
		for(let [uuid, worker] of this.templateWorkers){
			worker.handleGroupDeleted(groupID)
		}
	}
	getTemplateWorker(templateUUID){
		return this.templateWorkers.get(templateUUID)
	}
	getAvatarGroup(){
		if(this.renderer === null){
			console.error('queries for avatar info before the renderer is set')
			return
		}
		return this.renderer.avatarGroup
	}
	getOrCreateTemplateWorker(template){
		let worker = this.templateWorkers.get(template.get('uuid'))
		if(worker) return worker
		worker = new spaciblo.workers.TemplateWorker(template, this)
		this.templateWorkers.set(template.get('uuid'), worker)
		return worker
	}
	handleTemplateUnset(groupID, templateUUID){
		for(let [uuid, worker] of this.templateWorkers){
			worker.handleTemplateUnset(groupID, templateUUID)
		}
	}
	terminateTemplateWorker(worker){
		worker.terminate()
		this.templateWorkers.delete(worker.template.get('uuid'))
	}
})
