"use string";
/*
Client side scripts for templates.
*/
var spaciblo = spaciblo || {}
spaciblo.workers = spaciblo.workers || {}
spaciblo.events = spaciblo.events || {}

spaciblo.events.WorkerRequestedPORTSChange = 'worker-requested-ports-change'
spaciblo.events.WorkerRequestedAvatarUpdate = 'worker-requested-avatar-update'
spaciblo.events.WorkerRequestedAvatarTeleport = 'worker-requested-avatar-teleport'
spaciblo.events.WorkerRequestedFollowGroup = 'worker-requested-follow-group'
spaciblo.events.WorkerRequestedGroupModifications = 'worker-requested-group-modifications'
spaciblo.events.WorkerRequestedCreateGroup = 'worker-requested-create-group'
spaciblo.events.WorkerRequestedGroupSettingsChange = 'worker-requested-group-settings-change'

/*
For each template (not instance), a single web worker is created.
Each instance of the template in the scene uses the same web worker for its client side logic.
*/
spaciblo.workers.TemplateWorker = k.eventMixin(class {
	/*
	TODO Add more input events for workers:
	- start 'left-point', 'right-point', 'point' == gaze
	- pointer motion
	- stop pointing at
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
		this.subscribedToPointIntersects = false
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
	handlePointIntersectChanged(pointerName, serializableIntersect, serializedTemplateGroup){
		if(this.worker === null) return
		if(this.subscribedToPointIntersects === false) return
		this._postMessage(new spaciblo.client.PointIntersectMessage({
			pointer: pointerName,
			group: serializedTemplateGroup,
			intersect: serializableIntersect
		}))
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
	handleGroupRemoved(groupId){
		// This is called when a group is removed from the scene graph
		if(this.worker === null) return
		if(this.subscribedToGroupExistence){
			this._postMessage(new spaciblo.client.GroupRemovedMessage({
				groupId: groupId
			}))
		}
		const isTemplateGroup = this.templateGroups.has(groupId)
		if(isTemplateGroup) this.templateGroups.delete(groupId)

		// If that was the last group using this template, terminate the worker
		if(this.templateGroups.size === 0){
			this.manager.terminateTemplateWorker(this)
			return
		}

		if(isTemplateGroup && this.subscribedToTemplateGroupExistence){
			this._postMessage(new spaciblo.client.TemplateGroupRemovedMessage({
				groupId: groupId
			}))
		}
	}
	handleGroupSettingsChanged(changedKeys, group){
		if(this.subscribedToGroupExistence){
			this._postMessage(new spaciblo.client.GroupSettingsChangedMessage({
				groupId: group.state.id,
				changedKeys: changedKeys,
				settings: group.settings
			}))
		}
		if(this.templateGroups.has(group.state.id) && this.subscribedToTemplateGroupExistence){
			this._postMessage(new spaciblo.client.TemplateGroupSettingsChangedMessage({
				groupId: group.state.id,
				changedKeys: changedKeys,
				settings: group.settings
			}))
		}
	}
	handleTemplateGeometryLoaded(serializableGroup){
		if(this.templateGroups.has(serializableGroup.id) === false) return
		this._postMessage(new spaciblo.client.TemplateGeometryLoadedMessage({
			group: serializableGroup
		}))
	}
	handleTemplateUnset(groupId, templateUUID){
		// This is called when a group in the scene graph is no longer associated with a template
		if(this.templateGroups.has(groupId) === false) return
		this.templateGroups.delete(groupId)

		// If that was the last group using this template, terminate the worker
		if(this.templateGroups.size === 0){
			this.manager.terminateTemplateWorker(this)
			return
		}

		if(this.subscribedToTemplateGroupExistence){
			this._postMessage(new spaciblo.client.TemplateGroupRemovedMessage({
				groupId: groupId
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
				}, 0)
				break
			case 'group-modification':
				// selectors and modifiers come through as serializable JSON, so turn them back into classes
				data.selectors = data.selectors.map(data => { return vms.unmarshal(data) })
				data.modifiers = data.modifiers.map(data => { return vms.unmarshal(data) })
				this.manager.trigger(spaciblo.events.WorkerRequestedGroupModifications, data)
				break
			case 'create-group':
				this.manager.trigger(spaciblo.events.WorkerRequestedCreateGroup, data)
				break
			case 'change-ports':
				this.manager.trigger(spaciblo.events.WorkerRequestedPORTSChange, data)
				break
			case 'input-action-subscription':
				this.subscribedToInputAction = data.subscribed === true
				break
			case 'point-intersect-subscription':
				this.subscribedToPointIntersects = data.subscribed === true
				break
			case 'group-existence-subscription':
				this.subscribedToGroupExistence = data.subscribed === true
				break
			case 'template-group-existence-subscription':
				this.subscribedToTemplateGroupExistence = data.subscribed === true
				break
			case 'request-group-settings-change':
				this.manager.trigger(spaciblo.events.WorkerRequestedGroupSettingsChange, data)
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
			case 'query-group':
				const group = this.manager.getGroup(data.id)
				if(group === null){
					console.error('null group', data)
				} else {
					this.worker.postMessage(new spaciblo.client.GroupInfoMessage({
						group: group.serializeForWorker()
					}))
				}
				break
			case 'update-avatar':
				this.manager.trigger(spaciblo.events.WorkerRequestedAvatarUpdate, data)
				break
			case 'teleport-avatar':
				this.manager.trigger(spaciblo.events.WorkerRequestedAvatarTeleport, data)
				break
			case 'follow-group':
				this.manager.trigger(spaciblo.events.WorkerRequestedFollowGroup, data)
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
	handleGroupRemoved(groupId){
		for(let [uuid, worker] of this.templateWorkers){
			worker.handleGroupRemoved(groupId)
		}
	}
	handleGroupSettingsChanged(changedKeys, group){
		for(let [uuid, worker] of this.templateWorkers){
			worker.handleGroupSettingsChanged(changedKeys, group)
		}
	}
	handleTemplateGeometryLoaded(group){
		let serializedGroup = group.serializeForWorker()
		for(let [uuid, worker] of this.templateWorkers){
			worker.handleTemplateGeometryLoaded(serializedGroup)
		}
	}
	handlePointIntersectChanged(pointerName, intersect){
		if(intersect !== null){
			var serializableIntersect = spaciblo.three.serializeIntersect(intersect)
			// Find the group in the intersect.object's lineage that has a template
			let obj = intersect.object
			var serializedTemplateGroup = null
			while(typeof obj.template == 'undefined'){
				obj = obj.parent
				if(obj === null) break
			}
			if(typeof obj.template !== 'undefined'){
				serializedTemplateGroup = spaciblo.three.serializeGroup(obj)
			}
		} else {
			var serializableIntersect = null
			var serializableTemplateObj = null
		}
		for(let [uuid, worker] of this.templateWorkers){
			worker.handlePointIntersectChanged(pointerName, serializableIntersect, serializedTemplateGroup)
		}
	}
	getTemplateWorker(templateUUID){
		return this.templateWorkers.get(templateUUID)
	}
	getGroup(id){
		// id is the group's state id, not three.js id
		if(this.renderer === null) return null
		return this.renderer.getGroup(id)
	}
	getAvatarGroup(){
		if(this.renderer === null){
			console.error('queries for avatar info before the renderer is set')
			return null
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
	handleTemplateUnset(groupId, templateUUID){
		for(let [uuid, worker] of this.templateWorkers){
			worker.handleTemplateUnset(groupId, templateUUID)
		}
	}
	terminateTemplateWorker(worker){
		worker.terminate()
		this.templateWorkers.delete(worker.template.get('uuid'))
	}
})
