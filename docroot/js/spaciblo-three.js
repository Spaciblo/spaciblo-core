"use strict";

/*
Three.js specific code for the scene graph, rendering, picking, and input management. 
*/

var spaciblo = spaciblo || {}
spaciblo.three = spaciblo.three || {}
spaciblo.three.events = spaciblo.three.events || {}

spaciblo.three.UPDATE_DELTA = 0.1 // seconds between sim updates 

spaciblo.three.X_AXIS = new THREE.Vector3(1,0,0)
spaciblo.three.Y_AXIS = new THREE.Vector3(0,1,0)
spaciblo.three.Z_AXIS = new THREE.Vector3(0,0,1)

spaciblo.three.ZERO_VECTOR3 = new THREE.Vector3(0,0,0) // Do no set this to anything except zeros

// Handy data structures for use in animation frames
spaciblo.three.WORKING_QUAT = new THREE.Quaternion()
spaciblo.three.WORKING_QUAT_2 = new THREE.Quaternion()
spaciblo.three.WORKING_QUAT_3 = new THREE.Quaternion()
spaciblo.three.WORKING_VECTOR3 = new THREE.Vector3()
spaciblo.three.WORKING_VECTOR3_2 = new THREE.Vector3()
spaciblo.three.WORKING_VECTOR3_3 = new THREE.Vector3()
spaciblo.three.WORKING_EULER = new THREE.Euler()
spaciblo.three.WORKING_MATRIX4 = new THREE.Matrix4()

spaciblo.three.DEFAULT_BACKGROUND_COLOR = new THREE.Color(0x99DDff)
spaciblo.three.DEFAULT_LIGHT_COLOR = '#FFFFFF'
spaciblo.three.DEFAULT_LIGHT_INTENSITY = 0.7
spaciblo.three.DEFAULT_LIGHT_SKY_COLOR  = '#0077FF'
spaciblo.three.DEFAULT_LIGHT_GROUND_COLOR  = '#FFFFFF'

spaciblo.three.events.TemplateLoaded = 'three-template-loaded'
spaciblo.three.events.GroupSettingsChanged = 'three-group-settings-changed'
spaciblo.three.events.RequestedGroupSettingsChange = 'three-requested-group-settings-change'

spaciblo.three.DEFAULT_HEAD_POSITION = [0, 0.6, 0]
spaciblo.three.DEFAULT_TORSO_POSITION = [0, 0, 0]
spaciblo.three.HEAD_TORSO_Y_DISTANCE = spaciblo.three.DEFAULT_HEAD_POSITION[1] - spaciblo.three.DEFAULT_TORSO_POSITION[1]
spaciblo.three.DEFAULT_FOOT_POSITION = [0, -1.4, 0]
spaciblo.three.DEFAULT_AVATAR_HEIGHT = spaciblo.three.DEFAULT_HEAD_POSITION[1] - spaciblo.three.DEFAULT_FOOT_POSITION[1]
spaciblo.three.DEFAULT_LEFT_HAND_POSITION = [-0.5, -0.5, 0]
spaciblo.three.DEFAULT_RIGHT_HAND_POSITION = [0.5, -0.5, 0]

spaciblo.three.HEAD_NODE_NAME = 'head'
spaciblo.three.TORSO_NODE_NAME = 'torso'
spaciblo.three.LEFT_HAND_NODE_NAME = 'left_hand'
spaciblo.three.RIGHT_HAND_NODE_NAME = 'right_hand'
spaciblo.three.MOUTH_CLOSED_NAME = 'mouth_closed'
spaciblo.three.MOUTH_MID_NAME = 'mouth_mid'
spaciblo.three.MOUTH_OPENED_NAME = 'mouth_opened'
spaciblo.three.EYES_OPENED_NAME = 'eyes_opened'
spaciblo.three.EYES_CLOSED_NAME = 'eyes_closed'

/*
Renderer holds a Three.js scene and is used by SpacesComponent to render spaces
*/
spaciblo.three.Renderer = k.eventMixin(class {
	constructor(environment, inputManager, audioManager, workerManager, flocks){
		this.environment = environment
		this.inputManager = inputManager
		this.audioManager = audioManager
		this.workerManager = workerManager
		this.flocks = flocks

		this.flockIsVisible = false // Set by user actions from the input manager
		this.activeFlock = null // Null until the user toggles the flock open, when this is set and members are fetched
		this.flockIsLoaded = false
		this.flockGroup = new THREE.Group()
		this.flockGroup.name = 'flock'
		this.flockGroup.visible = false

		this.rootGroup = null // The spaciblo.three.Group at the root of the currently active space scene graph
		this.templateLoader = new spaciblo.three.TemplateLoader()

		this.clock = new THREE.Clock()
		this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 10000)

		this.scene = new THREE.Scene()
		this.pivotPoint = new THREE.Object3D() // Will hold the rootGroup and let us move the scene around the camera instead of moving the camera around in the scene, which doesn't work in VR
		this.pivotPoint.name = "PivotPoint"
		this.pivotPoint.position.set(
			spaciblo.three.DEFAULT_HEAD_POSITION[0] * -1,
			spaciblo.three.DEFAULT_HEAD_POSITION[1] * -1,
			spaciblo.three.DEFAULT_HEAD_POSITION[2] * -1
		)
		this.scene.add(this.pivotPoint)
		this.pivotPoint.add(this.flockGroup)

		// _inputRotation and _inputTranslation are used to rotate and translate the local avatar
		// They are usually set by a client worker script based on input action events
		this._inputRotation = [0,0,0]
		this._inputTranslation = [0,0,0]
		this.shouldTeleport = false 

		this.clientUUID = null	// Will be null until set in this.setClientUUID()
		this.avatarGroup = null	// Will be null until the avatar is created during an update addition
		this.remoteAvatarGroups = new Map() // clientUUID -> avatarGroup

		this.width = 0
		this.height = 0

		// These will be set iff this.setVRDisplay is called with a non-null parameter 
		this.vrDisplay = null
		this.vrFrameData = null
		this.firstVRFrame = true

		// object id -> spaciblo.three.Group
		// note, these may be groups from the simulation (in this.rootGroup) or groups from the flock (in this.flockGroup)
		this.objectMap = new Map()

		// These variables are used in _animate to handle motion
		this.cameraOrientationVector = new THREE.Vector3()	
		this.translationVector = new THREE.Vector3()
		this.rotationEuler = new THREE.Euler(0,0,0, 'YXZ')

		this.defaultSky = this._createDefaultSky() 
		this.scene.add(this.defaultSky)

		this.raycaster = new THREE.Raycaster()
		this.mouse = new THREE.Vector2(-10000, -10000)

		// When the user is pointing at something, this will be set to its first intersect
		this.leftPointIntersect = null
		this.rightPointIntersect = null
		this.gazePointIntersect = null

		this.renderer = new THREE.WebGLRenderer({
			antialias: true
		})
		this.renderer.domElement.setAttribute('class', 'three-js-spaces-renderer spaces-renderer')
		this.renderer.setClearColor(spaciblo.three.DEFAULT_BACKGROUND_COLOR)
		//this.renderer.shadowMap.enabled = true
		//this.renderer.shadowMap.type = THREE.PCFShadowMap

		this.inputManager.addListener(this._handleInputActionStarted.bind(this), spaciblo.events.InputActionStarted)
		this.el.addEventListener('mousemove', this._onMouseMove.bind(this), false)
		this.el.addEventListener('click', this._onMouseClick.bind(this), false)
		this._boundAnimate = this._animate.bind(this) // Since we use this in every frame, bind it once
		this._animate()
	}

	handleGroupModifications(selectors, modifiers){
		// for each selector, find its matched groups and then apply each modifer
		for(let selector of selectors){
			let matchedGroups = this.selectGroups(selector)
			for(let modifier of modifiers){
				for(let matchedGroup of matchedGroups){
					if(modifier.requiresCopy){
						this._ensureCopy(matchedGroup)
					}
					modifier.apply(matchedGroup)
				}
			}
		}
	}

	_ensureCopy(group){
		if(group.notACopy === true) return // Already split from the original
		group.notACopy = true
		if(group.material){
			group.material = group.material.clone()
		}
		// TODO when we have the ability to change the geometry we'll need to deep clone that, too
	}

	selectGroups(selector, group=this.pivotPoint, results=[]){
		if(selector.matches(group, this.objectMap)){
			results.push(group)
		}
		for(let child of group.children){
			this.selectGroups(selector, child, results)
		}
		return results
	}

	_handleInputActionStarted(eventName, action){
		switch(action.name){
			case 'show-flock':
				this._showFlock()
				break
			case 'hide-flock':
				this._hideFlock()
				break
			case 'toggle-flock':
				if(this.flockIsVisible){
					this._hideFlock()
				} else {
					this._showFlock()
				}
				break
		}
	}

	get inputRotation() { return this._inputRotation }
	set inputRotation(value){ this._inputRotation = [...value] }

	get inputTranslation() { return this._inputTranslation }
	set inputTranslation(value){ this._inputTranslation = [...value] }

	getGroup(id){ // Note, this is the group.state.id, not the three.js group id
		return this.objectMap.get(id) || null
	}

	get avatarPosition(){
		if(this.avatarGroup === null) return null
		return [this.rootGroup.position.x * -1, this.rootGroup.position.y * -1, this.rootGroup.position.z * -1]
	}
	get avatarOrientation(){
		if(this.avatarGroup === null) return null
		spaciblo.three.WORKING_QUAT.copy(this.pivotPoint.quaternion)
		spaciblo.three.WORKING_QUAT.inverse()
		return [spaciblo.three.WORKING_QUAT.x, spaciblo.three.WORKING_QUAT.y, spaciblo.three.WORKING_QUAT.z, spaciblo.three.WORKING_QUAT.w]
	}
	get avatarBodyUpdates(){
		if(this.avatarGroup === null){
			return []
		}
		let results = []
		this._addBodyUpdate(this.avatarGroup.head, spaciblo.three.HEAD_NODE_NAME, results)
		if(this.avatarGroup.torso){
			this._addBodyUpdate(this.avatarGroup.torso, spaciblo.three.TORSO_NODE_NAME, results)
		}
		this._addBodyUpdate(this.avatarGroup.leftHand, spaciblo.three.LEFT_HAND_NODE_NAME, results)
		this._addBodyUpdate(this.avatarGroup.rightHand, spaciblo.three.RIGHT_HAND_NODE_NAME, results)
		return results
	}
	_addBodyUpdate(node, name, results){
		// For a non-null scene node for a hand, add an avatar controller update data structure to results
		if(node === null){
			return
		}
		results.push({
			'name': name,
			'position': node.position.toArray(),
			'orientation': node.quaternion.toArray()
			// TODO send motion vectors
		})
	}
	_hideFlock(){
		this.flockIsVisible = false
	}
	_showFlock(){
		this.flockIsVisible = true

		// Position and rotate the flock in front of the head
		if(this.avatarGroup && this.avatarGroup.head){
			this.avatarGroup.head.getWorldPosition(spaciblo.three.WORKING_VECTOR3)
			this.pivotPoint.worldToLocal(spaciblo.three.WORKING_VECTOR3)
			this.flockGroup.position.set(
				spaciblo.three.WORKING_VECTOR3.x,
				spaciblo.three.WORKING_VECTOR3.y - spaciblo.three.HEAD_TORSO_Y_DISTANCE,
				spaciblo.three.WORKING_VECTOR3.z
			)

			this.avatarGroup.head.getWorldQuaternion(spaciblo.three.WORKING_QUAT)
			spaciblo.three.WORKING_QUAT_2.setFromRotationMatrix(this.pivotPoint.matrixWorld)
			spaciblo.three.WORKING_QUAT_2.inverse()
			spaciblo.three.WORKING_QUAT.multiplyQuaternions(spaciblo.three.WORKING_QUAT_2, spaciblo.three.WORKING_QUAT)
			spaciblo.three.WORKING_EULER.setFromQuaternion(spaciblo.three.WORKING_QUAT, 'YXZ')
			spaciblo.three.WORKING_EULER.x = 0
			spaciblo.three.WORKING_EULER.z = 0
			this.flockGroup.quaternion.setFromEuler(spaciblo.three.WORKING_EULER)
		}

		if(this.flockIsLoaded){
			// Flock is already loading or loaded, so nothing to do
			return
		}

		// Is there an active flock? If not, do nothing
		this.activeFlock = this.flocks.getActiveFlock()
		if(this.activeFlock === null){
			console.error('No active flock', this.flocks)
			return
		}

		// Load the active flock
		this.flockIsLoaded = true
		this.activeFlock.getMembers().fetch().then(() => {
			for(let member of this.activeFlock.getMembers()){
				this.flockGroup.add(this._createGroupFromFlockMember(member))
			}
		}).catch(err => {
			console.error('Error fetching flock members', err)
		})
	}
	setFollowGroup(followerId, leaderId=0, local=false){
		let followerGroup = this.objectMap.get(followerId) || null
		if(leaderId === 0 || leaderId === null){
			if(followerGroup === null){
				console.error('Tried to unfollow an unknown follower group with id', followerId)
				return
			}
			if(followerGroup.leaderGroup){
				followerGroup.leaderGroup.remove(followerGroup.leaderGroupShadow)
				followerGroup.leaderGroup = null
				followerGroup.leaderGroupShadow = null
			}
			return {
				id: followerId,
				leader: 0,
				position: [followerGroup.position.x, followerGroup.position.y, followerGroup.position.z],
				orientation: [followerGroup.quaternion.x, followerGroup.quaternion.y, followerGroup.quaternion.z, followerGroup.quaternion.w],
			}
		}
		if(followerGroup === null){
			console.error('Tried to follow an unknown follower group', followerId, leaderId)
			return
		}
		let leaderGroup = this.objectMap.get(leaderId) || null
		if(leaderGroup === null){
			console.error('Tried to follow an unknown leader group', followerId, leaderId)
			return
		}
		if(followerGroup.leaderGroup){
			if(followerGroup.leaderGroup === leaderGroup){
				// duplicate follow command, nothing to do
				return
			}
			followerGroup.leaderGroup.remove(followerGroup.leaderGroupShadow)
		}
		this.rootGroup.updateMatrixWorld(true)

		followerGroup.leaderGroup = leaderGroup

		// Save the follower's world position and orientation relative to the leader
		// We'll use this info in _animate to move the follower relative to the leader

		// Create a group in the leader group that is in the same current orientation and position as the follower group
		followerGroup.leaderGroupShadow = new THREE.Group()
		followerGroup.leaderGroupShadow.name = 'leader group shadow'
		followerGroup.leaderGroupShadow.local = local
		leaderGroup.add(followerGroup.leaderGroupShadow)

		followerGroup.matrixWorld.decompose(spaciblo.three.WORKING_VECTOR3, spaciblo.three.WORKING_QUAT, spaciblo.three.WORKING_VECTOR3_2)

		spaciblo.three.WORKING_QUAT_2.setFromRotationMatrix(followerGroup.leaderGroup.matrixWorld)
		spaciblo.three.WORKING_QUAT_2.inverse()
		followerGroup.leaderGroupShadow.quaternion.multiplyQuaternions(spaciblo.three.WORKING_QUAT_2, spaciblo.three.WORKING_QUAT)

		leaderGroup.worldToLocal(spaciblo.three.WORKING_VECTOR3)
		followerGroup.leaderGroupShadow.position.copy(spaciblo.three.WORKING_VECTOR3)

		return {
			id: followerId,
			leader: leaderId,
			position: [followerGroup.position.x, followerGroup.position.y, followerGroup.position.z],
			orientation: [followerGroup.quaternion.x, followerGroup.quaternion.y, followerGroup.quaternion.z, followerGroup.quaternion.w],
		}
	}
	_updateFollowingGroups(group=this.pivotPoint){
		if(group === null) return
		if(group.leaderGroup){
			group.leaderGroupShadow.matrixWorld.decompose(spaciblo.three.WORKING_VECTOR3, spaciblo.three.WORKING_QUAT, spaciblo.three.WORKING_VECTOR3_2)
 
			spaciblo.three.WORKING_QUAT_2.setFromRotationMatrix(group.parent.matrixWorld)
			spaciblo.three.WORKING_QUAT_2.inverse()
			group.quaternion.multiplyQuaternions(spaciblo.three.WORKING_QUAT_2, spaciblo.three.WORKING_QUAT)

			group.parent.worldToLocal(spaciblo.three.WORKING_VECTOR3)
			group.position.copy(spaciblo.three.WORKING_VECTOR3)
		}
		for(let child of group.children){
			this._updateFollowingGroups(child)
		}
	}
	_onMouseMove(ev){
		ev.preventDefault()
		let [offsetX, offsetY] = k.documentOffset(this.renderer.domElement)
		this.mouse.x = ((ev.clientX - offsetX) / this.el.offsetWidth) * 2 - 1
		this.mouse.y = - ((ev.clientY - offsetY) / this.el.offsetHeight) * 2 + 1
	}
	_onMouseClick(ev){
		const intersectionEvent = this._getClickIntersection()
		if(intersectionEvent === null) return

		// TODO Route this through the InputManager

		let obj = intersectionEvent.object
		// Head up the hierarchy until we find a worker or the root
		while(typeof obj.worker === 'undefined' && obj.parent !== null){
			obj = obj.parent
		}
		if(obj.worker){
			obj.worker.handleGroupClicked(obj)
		}
	}
	_getClickIntersection(){
		this.raycaster.setFromCamera(this.mouse, this.camera)
		let intersects = this.raycaster.intersectObjects(this.scene.children, true)
		if(intersects.length === 0) return null
		return intersects[0]
	}
	_getPointIntersect(pointerName){
		if(this.avatarGroup === null){
			return null
		}
		let pointGroup = null
		if(pointerName === 'left'){
			pointGroup = this.avatarGroup.leftHand
		} else if(pointerName === 'right'){
			pointGroup = this.avatarGroup.rightHand
		} else if(pointerName === 'gaze'){
			pointGroup = this.avatarGroup.headLine
		}
		if(pointGroup === null){
			console.error('unknown pointer name', pointerName)
			return null
		}

		this.scene.updateMatrixWorld(true)
		this.raycaster.ray.origin.setFromMatrixPosition(pointGroup.matrixWorld)
		pointGroup.getWorldQuaternion(spaciblo.three.WORKING_QUAT)
		this.raycaster.ray.direction.set(0, 0, -1).applyQuaternion(spaciblo.three.WORKING_QUAT)
		this.raycaster.ray.direction.normalize()
		// Turn off the avatarGroup while picking so we don't pick ourselves
		this.avatarGroup.visible = false
		let intersects = this.raycaster.intersectObjects([this.pivotPoint], true)
		this.avatarGroup.visible = true
		if(intersects.length == 0) return null
		return intersects[0]
	}
	/*
	updates this.*PointInterest and notifies the worker manager if there is a change
	*/
	_updatePointIntersect(pointerName, pointing){
		let currentIntersect = null
		if(pointing){
			var intersect = this._getPointIntersect(pointerName)
		} else {
			var intersect = null
		}
		switch(pointerName){
			case 'gaze':
				currentIntersect = this.gazePointIntersect
				this.gazePointIntersect = intersect
				break
			case 'left':
				currentIntersect = this.leftPointIntersect
				this.leftPointIntersect = intersect
				break
			case 'right':
				currentIntersect = this.rightPointIntersect
				this.rightPointIntersect = intersect
				break
			default:
				spaciblo.input.throttledConsoleLog('error: unknown pointer name', pointerName)
				return
		}
		if(pointing){
			if(intersect === null){
				if(currentIntersect !== null){
					this.workerManager.handlePointIntersectChanged(pointerName, null)
				}
			} else {
				if(currentIntersect === null || intersect.object !== currentIntersect.object){
					this.workerManager.handlePointIntersectChanged(pointerName, intersect)
				}
			}
		} else {
			if(currentIntersect !== null){
				this.workerManager.handlePointIntersectChanged(pointerName, null)
			}
		}

	}
	_createDefaultSky(){
		let vertexShader = document.getElementById('skyVertexShader').textContent
		let fragmentShader = document.getElementById('skyFragmentShader').textContent
		let uniforms = {
			topColor:    { value: new THREE.Color(0x0077ff) },
			bottomColor: { value: new THREE.Color(0xffffff) },
			offset:      { value: 33 },
			exponent:    { value: 0.8 }
		}
		let skyGeo = new THREE.SphereGeometry(4000, 32, 15)
		let skyMat = new THREE.ShaderMaterial({
			vertexShader: vertexShader,
			fragmentShader: fragmentShader,
			uniforms: uniforms,
			side: THREE.BackSide
		})
		return new THREE.Mesh(skyGeo, skyMat)
	}
	setClientUUID(clientUUID){
		this.clientUUID = clientUUID
	}
	setVRDisplay(vrDisplay) {
		if(vrDisplay !== null){
			if(this.vrFrameData === null){
				this.vrFrameData = new VRFrameData()
			}
			if(this.firstVRFrame === false){
				this.firstVRFrame = true
			}
		}
		this.vrDisplay = vrDisplay
	}
	setSize(width, height){
		if(this.vrDisplay){
			var eyeParams = this.vrDisplay.getEyeParameters('left')
			this.width = eyeParams.renderWidth * 2
			this.height = eyeParams.renderHeight
			this.renderer.setPixelRatio(1)
		} else {
			this.width = width
			this.height = height
			this.renderer.setPixelRatio(window.devicePixelRatio)
		}
		this.camera.aspect = this.width / this.height
		this.camera.updateProjectionMatrix()
		this.renderer.setSize(this.width, this.height, false)
	}
	setBackgroundColor(color){
		if(typeof color === 'undefined' || color === null || color === ''){
			this.renderer.setClearColor(spaciblo.three.DEFAULT_BACKGROUND_COLOR)
			return
		}
		this.scene.remove(this.defaultSky)
		this.renderer.setClearColor(new THREE.Color(color))
	}
	updateSpace(nodeUpdates=[], additions=[], deletions=[]) {
		nodeUpdates = nodeUpdates || []
		additions = additions || []
		deletions = deletions || []
		for(let addition of additions){
			if(this.objectMap.has(addition.id)){
				continue
			}
			if(addition.parent === -1){
				var parent = null
			} else {
				var parent = this.objectMap.get(addition.parent)
				if(typeof parent === 'undefined') {
					console.error('Tried to add to an unknown parent', this.objectMap, addition)
					continue
				}
			}
			let group = this._createGroupFromAddition(addition)
			group.lastUpdate = this.clock.elapsedTime + spaciblo.three.UPDATE_DELTA
			if(addition.parent === -1){
				// This is the root
				this.rootGroup = group
				this.rootGroup.name = 'Root'
				this.pivotPoint.add(this.rootGroup)
				this.setBackgroundColor(this.rootGroup.settings['background-color'])
			} else {
				parent.add(group)
			}
			if(group.isAvatar) this.remoteAvatarGroups.set(group.settings.clientUUID, group)
		}
		for(let deletion of deletions){
			let group = this.objectMap.get(deletion)
			if(typeof group === 'undefined'){
				continue
			}
			this.objectMap.delete(deletion)
			if(group.parent){
				group.parent.remove(group)
			} else {
				this.scene.remove(group)
			}
			for(let childId of group.getChildrenIds()){
				this.objectMap.delete(childId)
			}
			if(group.isAvatar){
				this.remoteAvatarGroups.delete(group.settings.clientUUID)
				this.audioManager.removeRemoteUser(group.settings.clientUUID)
			}
		}
		for(let update of nodeUpdates){
			let group = this.objectMap.get(update.id)
			if(typeof group === 'undefined'){
				console.error('Tried to update unknown object', update)
				continue
			}
			if(group.isLocalAvatar || (group.parent && group.parent.isLocalAvatar)){
				// We control the local avatar locally instead of letting the server tell us its position.
				// TODO Watch for big changes to the avatar position/orientation from the server and smoothly warp to them
				continue
			}
			group.lastUpdate = this.clock.elapsedTime + spaciblo.three.UPDATE_DELTA
			if(update.position){
				group.updatePosition.set(...update.position)
				group.position.set(...update.position)
			}
			if(update.orientation){
				group.updateQuaternion.set(...update.orientation)
				group.quaternion.set(...update.orientation)
			}
			if(update.translation){
				group.translationMotion.set(...update.translation)
			}
			if(update.rotation){
				group.rotationMotion.set(...update.rotation)
			}
			if(update.scale){
				group.scale.set(...update.scale)
			}
			if(typeof update.leader !== 'undefined'){
				this.setFollowGroup(update.id, update.leader)
			}
			group.updateSettings(update.settings)
			group.updateTemplate(update.templateUUID, this.templateLoader)

			if(group === this.rootGroup && group.settings['background-color']){
				this.setBackgroundColor(group.settings['background-color'])
			}
		}

		// Now that we've performed all of the graph changes, notify the client script workers
		for(let addition of additions){
			if(this.objectMap.has(addition.id) === false){
				continue
			}
			this.workerManager.handleGroupAdded(this.objectMap.get(addition.id))
		}
		for(let deletion of deletions){
			if(this.objectMap.has(deletion) === true){
				continue
			}
			this.workerManager.handleGroupRemoved(deletion)
		}
	}
	_createGroupFromFlockMember(flockMember){
		let group = new spaciblo.three.Group(this.workerManager)
		group.name = 'flock member'
		group.state = {}
		group.state.id = flockMember.get('uuid')
		group.settings = {}
		this.objectMap.set(group.state.id, group)
		group.flockMember = flockMember
		group.renderer = this
		group.position.set(...flockMember.getFloatArray('position', [0,0,0]))
		group.updatePosition.set(...flockMember.getFloatArray('position', [0,0,0]))
		group.quaternion.set(...flockMember.getFloatArray('orientation', [0,0,0,1]))
		group.updateQuaternion.set(...flockMember.getFloatArray('orientation', [0,0,0,1]))
		group.rotationMotion.set(...flockMember.getFloatArray('rotation', [0,0,0]))
		group.translationMotion.set(...flockMember.getFloatArray('translation', [0,0,0]))
		group.scale.set(...flockMember.getFloatArray('scale', [1,1,1]))
		group.updateTemplate(flockMember.get('templateUUID'), this.templateLoader)
		return group
	}
	_createGroupFromAddition(state){
		let group = new spaciblo.three.Group(this.workerManager)
		if(typeof state.id != 'undefined'){
			this.objectMap.set(state.id, group)
		}
		group.renderer = this
		group.state = state
		if(state.position){
			group.position.set(...state.position)
			group.updatePosition.set(...state.position)
		}
		if(state.orientation){
			group.quaternion.set(...state.orientation)
			group.updateQuaternion.set(...state.orientation)
		}
		if(state.scale){
			group.scale.set(...state.scale)
		}
		if(state.rotation){
			group.rotationMotion.set(...state.rotation)
		}
		if(state.translation){
			group.translationMotion.set(...state.translation)
		}
		group.updateSettings(state.settings)
		if(state.settings && state.settings.clientUUID){
			// Only avatars have clientUUIDs, so set up this up as an avatar
			group.isAvatar = true
			setTimeout(() => { group.setupParts() }, 0)
			if(this.clientUUID === state.settings.clientUUID){
				group.isLocalAvatar = true
				this.avatarGroup = group
			}
		}
		group.updateTemplate(state.templateUUID, this.templateLoader)
		if(typeof state.nodes !== 'undefined'){
			for(let node of state.nodes){
				group.add(this._createGroupFromAddition(node))
			}
		}
		return group
	}
	_getTeleportLocation(pointerName){
		/* 
		If the user is pointing, return the world coordinate Vector3 location they're pointing to
		Returns null if they're not pointing at anything
		*/
		let intersect = this._getPointIntersect(pointerName)
		if(intersect === null){
			return null
		}
		return intersect.point // This is a world coordinate Vector3
	}
	_findGroundIntersection(){
		/*
		Returns a height in worldspace if there is something below the avatar to stand on, otherwise null
		*/
		if(this.avatarGroup === null) return null
		let sourceGroup = this.avatarGroup.torso
		if(sourceGroup === null){
			sourceGroup = this.avatarGroup.head
		}
		this.scene.updateMatrixWorld(true)
		this.raycaster.ray.origin.setFromMatrixPosition(sourceGroup.matrixWorld)
		this.avatarGroup.getWorldQuaternion(spaciblo.three.WORKING_QUAT)
		this.raycaster.ray.direction.set(0, -1, 0).applyQuaternion(spaciblo.three.WORKING_QUAT)
		this.raycaster.ray.direction.normalize()
		// Turn off the avatarGroup while picking so we don't pick ourselves
		this.avatarGroup.visible = false
		let intersects = this.raycaster.intersectObjects([this.pivotPoint], true)
		this.avatarGroup.visible = true
		if(intersects.length === 0){
			return null
		}

		return intersects[0].point.y - spaciblo.three.DEFAULT_FOOT_POSITION[1]
	}
	_animate(){
		let delta = this.clock.getDelta()
		if(this.vrDisplay !== null){
			if(this.vrDisplay.isPresenting && this.firstVRFrame){
				// We can't render to VR if we're in the window's animation frame call, so punt to the next frame which will be from the VR display's frame call
				this.vrDisplay.requestAnimationFrame(this._boundAnimate)
				this.firstVRFrame = false
				return
			} else if(this.vrDisplay.isPresenting === false){
				// No longer presenting, so switch back to non-VR frames
				this.vrDisplay = null
				if(this.avatarGroup !== null){
					this.avatarGroup.head.quaternion.set(0,0,0,1)
					this.avatarGroup.head.position.set(...spaciblo.three.DEFAULT_HEAD_POSITION)
					this.avatarGroup.headLine.quaternion.set(0,0,0,1)
					this.avatarGroup.headLine.position.set(...spaciblo.three.DEFAULT_HEAD_POSITION)
					this.avatarGroup.headLine.visible = false
					if(this.avatarGroup.torso !== null){
						this.avatarGroup.torso.quaternion.set(0,0,0,1)
						this.avatarGroup.torso.position.set(...spaciblo.three.DEFAULT_TORSO_POSITION)
					}
					this.avatarGroup.leftHand.quaternion.set(0,0,0,1)
					this.avatarGroup.leftHand.position.set(...spaciblo.three.DEFAULT_LEFT_HAND_POSITION)
					this.avatarGroup.leftLine.visible = false
					this.avatarGroup.leftHand.hasGamepadPosition = false
					this.avatarGroup.leftHand.hasGamepadOrientation = false
					this.avatarGroup.rightHand.quaternion.set(0,0,0,1)
					this.avatarGroup.rightHand.position.set(...spaciblo.three.DEFAULT_RIGHT_HAND_POSITION)
					this.avatarGroup.rightLine.visible = false
					this.avatarGroup.rightHand.hasGamepadPosition = false
					this.avatarGroup.rightHand.hasGamepadOrientation = false
				}
				requestAnimationFrame(this._boundAnimate)
				this.trigger(spaciblo.events.AvatarPositionChanged)
				this.trigger(spaciblo.events.RendererExitedVR, this)
				return
			} else {
				// This is a VR frame, so render at will
				this.vrDisplay.requestAnimationFrame(this._boundAnimate)
			}
		} else {
			// This is a non-VR frame
			requestAnimationFrame(this._boundAnimate)
		}
		this.environment.updateGamepadInfo()
		this.inputManager.updateActions()

		/*
		If there's an avatar group:
			handle any input rotation or translation from the inputManager
			show or hide the pointing lines
		*/
		if(this.avatarGroup !== null){
			/*
			Many of the these calculations are reversed because for moving around in the world we move 
			the rootGroup and rotate the pivot point instead of moving the camera.
			The camera _is_ moved by the matrices we receive from the WebVR frame pose.
			The hands are moved also moved using data from the WebVR frame pose.
			*/

			if(this._inputRotation[0] !== 0 || this._inputRotation[1] !== 0 || this._inputRotation[2] !== 0){
				// get reversed input rotation
				this.rotationEuler.fromArray([
					this._inputRotation[0] * -delta,
					this._inputRotation[1] * -delta,
					this._inputRotation[2] * -delta
				])
				spaciblo.three.WORKING_QUAT.setFromEuler(this.rotationEuler)

				// convert from avatar local to pivot local and apply to the pivot orientation
				spaciblo.three.WORKING_QUAT_2.setFromRotationMatrix(this.pivotPoint.parent.matrixWorld)
				spaciblo.three.WORKING_QUAT_2.multiply(spaciblo.three.WORKING_QUAT)
				spaciblo.three.WORKING_QUAT_2.multiply(this.pivotPoint.quaternion)

				// save the results for render
				this.pivotPoint.quaternion.copy(spaciblo.three.WORKING_QUAT_2)
				this.pivotPoint.quaternion.normalize()
				this.pivotPoint.updateMatrixWorld()
			}

			// Apply input translation, where the translation vector is relative to avatar forward
			this.translationVector.fromArray(this._inputTranslation)
			this.translationVector.x *= -1
			if(this.translationVector.length() > 0){
				// Get the avatar's orientation vector
				spaciblo.three.WORKING_VECTOR3_2.set(0,0,1)
				spaciblo.three.WORKING_VECTOR3_2.applyQuaternion(this.pivotPoint.quaternion)

				// Get the rotation matrix from origin to the avatar's orientation
				spaciblo.three.WORKING_MATRIX4.lookAt(spaciblo.three.ZERO_VECTOR3, spaciblo.three.WORKING_VECTOR3_2, spaciblo.three.Y_AXIS)

				// Scale the motion by the time delta
				this.translationVector.multiplyScalar(delta)

				// Apply the rotation matrix to the translation motion
				this.translationVector.applyMatrix4(spaciblo.three.WORKING_MATRIX4)
				this.translationVector.x *= -1
				this.translationVector.y *= -1
				// Now add the rotated and scaled motion vector to the scene position
				this.rootGroup.position.add(this.translationVector)
			}

			// Move the avatar group in the scene to line up with the camera
			this.avatarGroup.position.set(
				this.rootGroup.position.x * -1, 
				this.rootGroup.position.y * -1, 
				this.rootGroup.position.z * -1
			)
			this.avatarGroup.quaternion.copy(this.pivotPoint.quaternion)
			this.avatarGroup.quaternion.inverse()

			if(this.avatarGroup.headLine){
				this.avatarGroup.headLine.visible = this.inputManager.isActionActive('point')
				this.avatarGroup.leftLine.visible = this.inputManager.isActionActive('left-point')
				this.avatarGroup.rightLine.visible = this.inputManager.isActionActive('right-point')
				this._updatePointIntersect('gaze', this.avatarGroup.headLine.visible)
				this._updatePointIntersect('left', this.avatarGroup.leftLine.visible)
				this._updatePointIntersect('right', this.avatarGroup.rightLine.visible)
			}
		}

		if(this.shouldTeleport){
			let teleportPointer = this.shouldTeleport
			this.shouldTeleport = false
			if(this.avatarGroup !== null){
				let destination = this._getTeleportLocation(teleportPointer) // Returns a world coordinate Vector3
				if(destination !== null){
					spaciblo.three.WORKING_VECTOR3.copy(destination)
					this.rootGroup.worldToLocal(spaciblo.three.WORKING_VECTOR3) // Convert to rootGroup local coordinates
					spaciblo.three.WORKING_VECTOR3.set(
						spaciblo.three.WORKING_VECTOR3.x, 
						spaciblo.three.WORKING_VECTOR3.y - spaciblo.three.DEFAULT_FOOT_POSITION[1], 
						spaciblo.three.WORKING_VECTOR3.z
					)
					spaciblo.three.WORKING_VECTOR3.negate() // Negate because we move the rootGroup instead of the camera
					this.rootGroup.position.copy(spaciblo.three.WORKING_VECTOR3)
				}
			}
		}

		// Move things that need moving since their last update from the server
		if(this.rootGroup){
			this.rootGroup.interpolate(this.clock.elapsedTime)
			this.rootGroup.updateAvatars(this.audioManager)
		}

		this.flockGroup.visible = this.flockIsVisible // set by user actions from the input manager

		if(this.vrDisplay){
			this.vrDisplay.getFrameData(this.vrFrameData)

			if(this.avatarGroup !== null && this.avatarGroup.head !== null){
				// Update the head 
				if(this.vrFrameData.pose.orientation !== null){
					this.avatarGroup.head.quaternion.set(...this.vrFrameData.pose.orientation)
					this.avatarGroup.headLine.quaternion.set(...this.vrFrameData.pose.orientation)
				}
				if(this.vrFrameData.pose.position !== null){
					this.avatarGroup.head.position.set(
						spaciblo.three.DEFAULT_HEAD_POSITION[0] + this.vrFrameData.pose.position[0],
						spaciblo.three.DEFAULT_HEAD_POSITION[1] + this.vrFrameData.pose.position[1],
						spaciblo.three.DEFAULT_HEAD_POSITION[2] + this.vrFrameData.pose.position[2]
					)
					this.avatarGroup.headLine.position.set(
						this.avatarGroup.head.position.x,
						this.avatarGroup.head.position.y - 0.5,
						this.avatarGroup.head.position.z
					)
				}

				// Update the torso by positioning and orienting it underneath the head
				if(this.avatarGroup.torso !== null){
					this.avatarGroup.torso.position.set(
						this.avatarGroup.head.position.x,
						this.avatarGroup.head.position.y - spaciblo.three.HEAD_TORSO_Y_DISTANCE,
						this.avatarGroup.head.position.z
					)
					spaciblo.three.WORKING_EULER.setFromQuaternion(this.avatarGroup.head.quaternion, 'YXZ')
					spaciblo.three.WORKING_EULER.x = 0
					spaciblo.three.WORKING_EULER.z = 0
					this.avatarGroup.torso.quaternion.setFromEuler(spaciblo.three.WORKING_EULER)
				}

				// First, make hands locally invisible
				if(this.avatarGroup.leftHand) this.avatarGroup.leftHand.visible = false
				if(this.avatarGroup.rightHand) this.avatarGroup.rightHand.visible = false

				// Update and make visible any gamepads that are considered hands
				if(typeof navigator.getGamepads === 'function'){
					let handHasPosition = false
					for(let gamepad of navigator.getGamepads()){
						if(gamepad === null || typeof gamepad.pose === 'undefined') continue
						// Find the hand to change
						let handNode = null
						if(typeof gamepad.hand === 'string'){
							if(gamepad.hand === 'left'){
								handNode = this.avatarGroup.leftHand
							} else if(gamepad.hand === 'right'){
								handNode = this.avatarGroup.rightHand
							}
						} else if(typeof gamepad.index === 'number'){
							// No gamepad.hand, so use index to arbitrarily assign to a hand
							if(gamepad.index === 0){
								handNode = this.avatarGroup.leftHand
							} else if(gamepad.index === 1) {
								handNode = this.avatarGroup.rightHand
							}
						}

						if(handNode === null){
							//spaciblo.input.throttledConsoleLog('Gamepad has no known hand', gamepad)
							continue
						}

						// Found a hand node, so make it locally visible (will send updates below)
						handNode.visible = true

						// Set the hand orientation
						if(gamepad.pose.hasOrientation === true && gamepad.pose.orientation !== null){
							// TODO figure out why Vive controller orientation is not iterable like ...gamepad.pose.orientation
							handNode.hasGamepadOrientation = true
							handNode.quaternion.set(gamepad.pose.orientation[0],
								gamepad.pose.orientation[1],
								gamepad.pose.orientation[2],
								gamepad.pose.orientation[3]
							)
						} else {
							handNode.hasGamepadOrientation = false
						}

						// Set the hand position
						if(gamepad.pose.hasPosition === true && gamepad.pose.position !== null){
							handHasPosition = true
							handNode.hasGamepadPosition = true
							handNode.position.set(
								spaciblo.three.DEFAULT_HEAD_POSITION[0] + gamepad.pose.position[0],
								spaciblo.three.DEFAULT_HEAD_POSITION[1] + gamepad.pose.position[1],
								spaciblo.three.DEFAULT_HEAD_POSITION[2] + gamepad.pose.position[2]
							)
						} else {
							handNode.hasGamepadPosition = false
						}
					}

					if(this.avatarGroup.leftHand && this.avatarGroup.leftHand.visible !== this.avatarGroup.leftHand.isSetVisible()) {
						this.avatarGroup.leftHand.settings.visible = String(this.avatarGroup.leftHand.visible)
						this.trigger(spaciblo.three.events.RequestedGroupSettingsChange, {
							groupId: this.avatarGroup.leftHand.state.id,
							settings: { visible: String(this.avatarGroup.leftHand.visible) }
						})
					}
					if(this.avatarGroup.rightHand && this.avatarGroup.rightHand.visible !== this.avatarGroup.rightHand.isSetVisible()) {
						this.avatarGroup.rightHand.settings.visible = String(this.avatarGroup.rightHand.visible)
						this.trigger(spaciblo.three.events.RequestedGroupSettingsChange, {
							groupId: this.avatarGroup.rightHand.state.id,
							settings: { visible: String(this.avatarGroup.rightHand.visible) }
						})
					}

					// If there are no hands with position data, orient the hands group based on head position
					if(handHasPosition === false){
						spaciblo.three.WORKING_EULER.setFromQuaternion(this.avatarGroup.head.quaternion, 'YXZ')
						spaciblo.three.WORKING_EULER.x = 0
						spaciblo.three.WORKING_EULER.z = 0
						if(this.avatarGroup.leftHand !== null){
							if(this.avatarGroup.leftHand.hasGamepadPosition === false){
								spaciblo.three.WORKING_VECTOR3.set(...spaciblo.three.DEFAULT_LEFT_HAND_POSITION)
								spaciblo.three.WORKING_VECTOR3.applyEuler(spaciblo.three.WORKING_EULER)
								this.avatarGroup.leftHand.position.copy(spaciblo.three.WORKING_VECTOR3)
							}
							if(this.avatarGroup.leftHand.hasGamepadOrientation === false){
								this.avatarGroup.leftHand.quaternion.setFromEuler(spaciblo.three.WORKING_EULER)
							}
						}

						if(this.avatarGroup.rightHand !== null){
							if(this.avatarGroup.rightHand.hasGamepadPosition === false){
								spaciblo.three.WORKING_VECTOR3.set(...spaciblo.three.DEFAULT_RIGHT_HAND_POSITION)
								spaciblo.three.WORKING_VECTOR3.applyEuler(spaciblo.three.WORKING_EULER)
								this.avatarGroup.rightHand.position.copy(spaciblo.three.WORKING_VECTOR3)
							}
							if(this.avatarGroup.rightHand.hasGamepadOrientation === false){
								this.avatarGroup.rightHand.quaternion.setFromEuler(spaciblo.three.WORKING_EULER)
							}
						}
					}
				}
			}

			if(this.rootGroup){
				this.rootGroup.updateMatrixWorld(true)
			}
			this._updateFollowingGroups()

			this.renderer.autoClear = false
			this.scene.matrixAutoUpdate = false

			// The view is assumed to be full-window in VR because the canvas element fills the entire HMD screen[s]
			this.renderer.clear()
			this.renderer.setViewport(0, 0, this.width * 0.5, this.height)

			// Render left eye
			this.camera.projectionMatrix.fromArray(this.vrFrameData.leftProjectionMatrix)
			this.scene.matrix.fromArray(this.vrFrameData.leftViewMatrix)
			this.scene.updateMatrixWorld(true)
			this.renderer.render(this.scene, this.camera)

			// Prep for right eye
			this.renderer.clearDepth()
			this.renderer.setViewport(this.width * 0.5, 0, this.width * 0.5, this.height)

			// Render right eye
			this.camera.projectionMatrix.fromArray(this.vrFrameData.rightProjectionMatrix)
			this.scene.matrix.fromArray(this.vrFrameData.rightViewMatrix)
			this.scene.updateMatrixWorld(true)
			this.renderer.render(this.scene, this.camera)

			this.vrDisplay.submitFrame()
			this.trigger(spaciblo.events.AvatarPositionChanged)
		} else {
			if(this.rootGroup){
				this.rootGroup.updateMatrixWorld(true)
			}
			this._updateFollowingGroups()
			this.renderer.autoClear = true
			this.scene.matrixAutoUpdate = true
			THREE.GLTFLoader.Shaders.update(this.scene, this.camera)
			this.renderer.render(this.scene, this.camera)
		}

		// Update the audio manager with the position and orientation of the local and remote avatars
		if(this.avatarGroup !== null && this.avatarGroup.head !== null){
			this.audioManager.setHeadPositionAndOrientation(...this._getGroupPositionAndOrientation(this.avatarGroup.head))
			for(let [clientUUID, remoteAvatarGroup] of this.remoteAvatarGroups){
				this.audioManager.setRemoteUserPositionAndOrientation(clientUUID, ...this._getGroupPositionAndOrientation(remoteAvatarGroup))
			}
		}
	}
	_getGroupPositionAndOrientation(group){
		// Returns world position x,y,z orientation x,y,z up vector x,y,z
		group.updateMatrixWorld()
		spaciblo.three.WORKING_VECTOR3.setFromMatrixPosition(group.matrixWorld)

		// Save and zero out three elements of the group's world matrix
		let matrix = group.matrix
		const mx = matrix.elements[12]
		matrix.elements[12] = 0
		const my = matrix.elements[13]
		matrix.elements[13] = 0
		const mz = matrix.elements[14]
		matrix.elements[14] = 0

		// Multiply the orientation vector by the world matrix of the group
		spaciblo.three.WORKING_VECTOR3_2.set(0, 0, 1)
		spaciblo.three.WORKING_VECTOR3_2.applyMatrix4(matrix)
		spaciblo.three.WORKING_VECTOR3_2.normalize()

		// Multiply the up vector by the world matrix
		spaciblo.three.WORKING_VECTOR3_3.set(0, -1, 0)
		spaciblo.three.WORKING_VECTOR3_3.applyMatrix4(matrix)
		spaciblo.three.WORKING_VECTOR3_3.normalize()

		// Restore the zeroed elements of the head's world matrix
		matrix.elements[12] = mx
		matrix.elements[13] = my
		matrix.elements[14] = mz

		return [
			spaciblo.three.WORKING_VECTOR3.x, spaciblo.three.WORKING_VECTOR3.y, spaciblo.three.WORKING_VECTOR3.z, 
			spaciblo.three.WORKING_VECTOR3_2.x, spaciblo.three.WORKING_VECTOR3_2.y, spaciblo.three.WORKING_VECTOR3_2.z,
			spaciblo.three.WORKING_VECTOR3_3.x, spaciblo.three.WORKING_VECTOR3_3.y, spaciblo.three.WORKING_VECTOR3_3.z
		]
	}
	_addGeometry(geometry, material){
		var mesh = new THREE.Mesh(geometry, material)
		this.scene.add(mesh)
		return mesh
	}
	get el(){
		return this.renderer.domElement
	}
})

// Helper functions for converting update.settings strings into native types
spaciblo.three.parseSettingFloat = function(name, settings, defaultValue=0){
	let val = parseFloat(settings[name])
	if(Number.isNaN(val)){
		val = defaultValue
	}
	return val
}
spaciblo.three.parseSettingFloatArray = function(name, settings, defaultValue=null){
	if(typeof settings[name] !== 'string'){
		return defaultValue
	}
	if(settings[name] === ''){
		return defaultValue
	}
	return spaciblo.three.parseFloatArray(settings[name])
}
spaciblo.three.parseFloatArray = function(value){
	let tokens = value.split(',')
	let results = []
	for(let token of tokens){
		let val = parseFloat(token)
		if(Number.isNaN(val)){
			val = 0
		}
		results[results.length] = val
	}
	return results
}
spaciblo.three.parseSettingColor = function(name, settings, defaultValue='#FFFFFF'){
	if(typeof settings[name] !== 'string' || settings[name] === ''){
		return defaultValue
	}
	return settings[name]
}

spaciblo.three.TemplateLoader = k.eventMixin(class {
	constructor(){
		// Added templates move from the fetchQueue, to the loadQueue, to the loadedTemplates list
		this._fetchQueue = [] 		// Templates whose metadata we will fetch
		this._loadQueue = []		// Templates who metadata we've fetched and whose geometry we will load
		this._loadedTemplates = [] 	// Templates whose metadata is fetched or that have failed
	}
	getOrAddTemplate(templateUUID){
		let [index, listName, array] = this._indexAndListForTemplate(templateUUID)
		if(index !== -1){
			return array[index]
		}
		let template = new be.api.Template({ uuid: templateUUID })
		this._addTemplateToFetchQueue(template)
		return template
	}
	removeTemplate(templateUUID){
		let [index, listName, array] = this._indexAndListForTemplate(templateUUID)
		if(index == -1) return
		switch(listName){
			case 'fetch':
				this._fetchQueue.splice(index, 1)
				break
			case 'loading':
				this._loadQueue.splice(index, 1)
				break
			case 'loaded':
				this._loadedTemplates.splice(index, 1)
				break
			default:
				console.error('unknown list name', listName)
		}
	}
	_addTemplateToFetchQueue(template){
		template.loading = true
		this._fetchQueue.push(template)
		template.fetch().then(() =>{
			this._fetchQueue.splice(this._fetchQueue.indexOf(template), 1)
			if(template.get('geometry')){
				this._addTemplateToLoadQueue(template)
			} else {
				this._addTemplateToLoaded(template)
			}
		}).catch((err) => {
			this._fetchQueue.splice(this._fetchQueue.indexOf(template), 1)
			this._addTemplateToLoaded(template)
		})
	}
	_addTemplateToLoadQueue(template){
		this._loadQueue.push(template)
		const extension = template.getGeometryExtension()
		const templateUUID = template.get('uuid')
		if(extension === 'gltf'){
			spaciblo.three.GLTFLoader.load(template.geometryURL()).then(gltf => {
				template.group = gltf.scene
				template.group.templateUUID = templateUUID
				this._loadQueue.splice(this._loadQueue.indexOf(template), 1)
				this._addTemplateToLoaded(template)
			}).catch(err => {
				console.error('Could not fetch gltf', err)
			})
		} else if(extension === 'obj'){
			spaciblo.three.OBJLoader.load(template.getBaseURL(), template.get('geometry')).then(obj => {
				template.group = obj
				template.group.templateUUID = templateUUID
				this._loadQueue.splice(this._loadQueue.indexOf(template), 1)
				this._addTemplateToLoaded(template)
			}).catch(err => {
				console.error('Could not fetch obj', err)
			})
		} else {
			console.error('Unknown extension for template geometry.', extension, template)
			this._loadQueue.splice(this._loadQueue.indexOf(template), 1)
			this._addTemplateToLoaded(template)
		}
	}
	_addTemplateToLoaded(template){
		template.loading = false
		this._loadedTemplates.push(template)
		template.trigger(spaciblo.three.events.TemplateLoaded, template)
	}
	_indexAndListForTemplate(templateUUID){
		// returns [index,fetch/load/loaded,array] for a template or [-1, null, null] if it isn't known
		for(let i = 0; i < this._fetchQueue.length; i++){
			if(this._fetchQueue[i].get('uuid') === templateUUID){
				return [i, 'fetch', this._fetchQueue]
			}
		}
		for(let i =0; i < this._loadQueue.length; i++){
			if(this._loadQueue[i].get('uuid') === templateUUID){
				return [i, 'loading', this._loadQueue]
			}
		}
		for(let i = 0; i < this._loadedTemplates.length; i++){
			if(this._loadedTemplates[i].get('uuid') === templateUUID){
				return [i, 'loaded', this._loadedTemplates]
			}
		}
		return [-1, null, null]
	}
})

/*
An extension of the Three Group with app specific information
*/
spaciblo.three.Group = function(workerManager){
	THREE.Group.call(this)
	this.workerManager = workerManager
	this.renderer = null // Set by creator
	this.lastUpdate = null									// time in milliseconds of last update
	this.updatePosition = new THREE.Vector3(0,0,0) 			// The position recieved from the sim
	this.updateQuaternion = new THREE.Quaternion(0,0,0,1) 	// the orientation receive from the sim
	this.rotationMotion = new THREE.Vector3(0,0,0)			// the rotation motion received from the sim
	this.translationMotion = new THREE.Vector3(0,0,0)		// the translation motion received from the sim

	this.templateGroup = null // If the template has loaded geometry, this will be set to a THREE.Group
	this.isCopy = false // If a modifier that requires copy is applied to this group, this will be set to tru in this.ensureCopy

	this.leaderGroup = null
	this.leaderStartWorldPosition = null
	this.leaderStartWorldOrientation = null
	this.followerStartWorldPosition = null
	this.followerStartWorldOrientation = null

	this.isAvatar = false 		// True if the group represents any user's avatar
	this.isLocalAvatar = false	// True if the group represents the local user's avatar
	// head, leftHand, and rightHand are three.js Object3Ds (Groups or Meshes) that are avatar body parts 
	this.head = null
	this.torso = null
	this.leftHand = null
	this.rightHand = null
	// left and right lines are the rays used to point at things
	this.leftLine = null
	this.rightLine = null

	// These are children of the head, which are populated in this.setupSubParts
	// the mouth children are set via this.updateMouth
	this.mouthClosed = null
	this.mouthMid = null
	this.mouthOpened = null
	// the eye children are set via this.updateEyes
	this.eyesOpened = null
	this.eyesClosed = null
	this.nextBlink = null
	this.setNextBlink()
}

spaciblo.three.Group.prototype = Object.assign(Object.create(THREE.Group.prototype), {
	serializeForWorker: function(){
		return spaciblo.three.serializeGroup(this)
	},
	getChildrenIds: function(results=[]){
		if(this.children === null){
			return results
		}
		for(let child of this.children){
			if(typeof child.state !== 'undefined' && typeof child.state.id !== 'undefined'){
				results.push(child.state.id)
			}
			if(typeof child.getChildrenIds !== 'undefined'){
				child.getChildrenIds(results)
			}
		}
		return results
	},
	updateTemplate: function(templateUUID, templateLoader){
		if(typeof templateUUID === 'undefined' || templateUUID.length == 0) return
		if(this.templateGroup){
			this.remove(this.templateGroup)
			if(this.workerManager){
				this.workerManager.handleTemplateUnset(this.state.id, this.templateGroup.templateUUID)
			}
			this.templateGroup = null
		}
		if(templateUUID == spaciblo.api.RemoveKeyIndicator){
			// We already removed the Template and this value indicates that there is no more template.
			return
		}

		this.template = templateLoader.getOrAddTemplate(templateUUID)
		if(this.workerManager){
			this.worker = this.workerManager.getOrCreateTemplateWorker(this.template)
		}

		if(this.template.loading === true){
			this.template.addListener(() => {
				if(this.template.group){
					this.add(this.template.group.clone())
					if(this.name === spaciblo.three.HEAD_NODE_NAME){
						this.setupSubParts()
					}
				}
				if(this.worker) this.worker.handleTemplateGroupAdded(this)
			}, spaciblo.three.events.TemplateLoaded, true)
		} else {
			if(this.template.group){
				this.add(this.template.group.clone())
				if(this.name === spaciblo.three.HEAD_NODE_NAME){
					this.setupSubParts()
				}
			}
			if(this.worker) this.worker.handleTemplateGroupAdded(this)
		}
	},
	isSetVisible: function(){
		if(typeof this.settings !== 'object') return true
		if(typeof this.settings['visible'] !== 'string') return true
		return this.settings['visible'] !== 'false'
	},
	updateSettings: function(settings){
		if(typeof this.settings === 'object') {
			// Save the key names of changes so we can fire an event at the end
			var changedKeys = Object.keys(settings).filter(key => { return this.settings[key] !== settings[key] })
			this.settings = Object.assign(this.settings, settings)
		} else {
			var changedKeys = [] // Newly created groups do not fire a settings change event
			this.settings = Object.assign({}, settings)
		}
		// Delete any settings with the magic removal indicator
		for(let setting in this.settings){
			if(this.settings[setting] == spaciblo.api.RemoveKeyIndicator){
				delete this.settings[setting]
			}
		}
		// Set name on the group itself for easier debugging
		if(this.settings.name){
			this.name = this.settings.name
		}
		// Update visibility based on visiblity setting
		this.visible = this.settings.visible !== 'false'

		// Update the light
		if(typeof this.settings['light-type'] === 'string'){
			if(this.settingsLight){
				this.remove(this.settingsLight)
			}

			let color = spaciblo.three.parseSettingColor('light-color', this.settings, spaciblo.three.DEFAULT_LIGHT_COLOR)
			let intensity = spaciblo.three.parseSettingFloat('light-intensity', this.settings, spaciblo.three.DEFAULT_LIGHT_INTENSITY)
			let distance = spaciblo.three.parseSettingFloat('light-distance', this.settings, 0)
			let decay = spaciblo.three.parseSettingFloat('light-decay', this.settings, 1)
			let target = spaciblo.three.parseSettingFloatArray('light-target', this.settings, [0, 0, 0])

			switch(this.settings['light-type']){
				case 'ambient':
					this.settingsLight = new THREE.AmbientLight(color, intensity)
					break

				case 'directional':
					this.settingsLight = new THREE.DirectionalLight(color, intensity)
					this.settingsLight.target.position.set(...target)
					this.settingsLight.add(this.settingsLight.target)
					//this.settingsLight.castShadow = true
					//this.settingsLight.shadow.mapSize.width = 512
					//this.settingsLight.shadow.mapSize.height = 512
					//this.settingsLight.shadow.camera.zoom = 0.3
					//this.settingsLight.shadow.bias = 0.0001
					break

				case 'point':
					this.settingsLight = new THREE.PointLight(color, intensity, distance, decay)
					//this.settingsLight.castShadow = true
					//this.settingsLight.shadow.mapSize.width = 1024
					//this.settingsLight.shadow.mapSize.height = 1024
					//this.settingsLight.shadow.bias = 0.0001
					break

				case 'spot':
					let angle = spaciblo.three.parseSettingFloat('light-angle', this.settings, Math.PI / 2)
					let penumbra = spaciblo.three.parseSettingFloat('light-penumbra', this.settings, 0)
					this.settingsLight = new THREE.SpotLight(color, intensity, distance, angle, penumbra, decay)
					this.settingsLight.target.position.set(...target)
					this.settingsLight.add(this.settingsLight.target)
					break

				case 'hemisphere':
					let skyColor = spaciblo.three.parseSettingColor('light-sky-color', this.settings, spaciblo.events.DEFAULT_LIGHT_SKY_COLOR)
					let groundColor = spaciblo.three.parseSettingColor('light-ground-color', this.settings, spaciblo.events.DEFAULT_LIGHT_GROUND_COLOR)
					this.settingsLight = new THREE.HemisphereLight(skyColor, groundColor, intensity)
					break

				case '':
					this.settingsLight = null
					break
					
				default:
					console.error('unknown light-type', this.settings)
					this.settingsLight = null
			}
			if(this.settingsLight !== null){
				this.settingsLight.name = 'settings-light'
				this.settingsLight.position.set(0,0,0) // It's the light's group that sets the position and orientation
				this.add(this.settingsLight)
			}
		}
		// Fire a change event if necessary
		if(changedKeys.length > 0){
			this.renderer.trigger(spaciblo.three.events.GroupSettingsChanged, changedKeys, this)
		}
	},
	setupParts: function(){
		// Find the body nodes created by update additions from the simulator

		this.head = spaciblo.three.findChildNodeByName(spaciblo.three.HEAD_NODE_NAME, this, true)[0]
		if(typeof this.head === 'undefined' || this.head === null){
			console.error('Could not set up avatar head, aborting parts setup', this)
			return
		}
		this.head.position.set(...spaciblo.three.DEFAULT_HEAD_POSITION)

		this.torso = spaciblo.three.findChildNodeByName(spaciblo.three.TORSO_NODE_NAME, this, true)[0] || null
		if(this.torso !== null){
			this.torso.position.set(...spaciblo.three.DEFAULT_TORSO_POSITION)
		}

		this.leftHand = spaciblo.three.findChildNodeByName(spaciblo.three.LEFT_HAND_NODE_NAME, this, true)[0]
		this.leftHand.position.set(...spaciblo.three.DEFAULT_LEFT_HAND_POSITION)
		this.leftHand.hasGamepadPosition = false
		this.leftHand.hasGamepadOrientation = false

		this.rightHand = spaciblo.three.findChildNodeByName(spaciblo.three.RIGHT_HAND_NODE_NAME, this, true)[0]
		this.rightHand.position.set(...spaciblo.three.DEFAULT_RIGHT_HAND_POSITION)
		this.rightHand.hasGamepadPosition = false
		this.rightHand.hasGamepadOrientation = false

		if(this.isLocalAvatar){
			this.head.visible = false
			if(this.torso){
				this.torso.visible = false
			}
		}

		this.headLine = new THREE.Group()
		this.headLine.name = 'head line'
		this.headLine.position.set(...spaciblo.three.DEFAULT_HEAD_POSITION) // Renderer will move this whenever it moves the head
		this.headLine.visible = false // Shown when the user initiates a point gesture
		this.add(this.headLine)
		this.gazeCursor = new THREE.Mesh(
			new THREE.PlaneGeometry(0.02, 0.02),
			new THREE.MeshBasicMaterial({
				map: THREE.ImageUtils.loadTexture( 'images/crosshairs.png' ),
				transparent: true,
			})
		)
		this.gazeCursor.position.set(0, 0, -0.51)
		this.headLine.add(this.gazeCursor)

		this.leftLine = this._makePointerLine()
		this.leftHand.add(this.leftLine)
		this.leftLine.visible = false // Shown when the user initiates a left-point gesture
		this.rightLine = this._makePointerLine()
		this.rightHand.add(this.rightLine)
		this.rightLine.visible = false // Shown when the user initiates a right-point gesture
	},
	setupSubParts: function(){
		this.mouthClosed = spaciblo.three.findChildNodeByName(spaciblo.three.MOUTH_CLOSED_NAME, this, true)[0] || null
		this.mouthMid = spaciblo.three.findChildNodeByName(spaciblo.three.MOUTH_MID_NAME, this, true)[0] || null
		if(this.mouthMid) this.mouthMid.visible = false
		this.mouthOpened = spaciblo.three.findChildNodeByName(spaciblo.three.MOUTH_OPENED_NAME, this, true)[0] || null
		if(this.mouthOpened) this.mouthOpened.visible = false

		this.eyesOpened = spaciblo.three.findChildNodeByName(spaciblo.three.EYES_OPENED_NAME, this, true)[0] || null
		this.eyesClosed = spaciblo.three.findChildNodeByName(spaciblo.three.EYES_CLOSED_NAME, this, true)[0] || null
		if(this.eyesClosed) this.eyesClosed.visible = false

		console.log('sub parts', this.mouthClosed, this.mouthMid, this.mouthOpened, this.eyesOpened, this.eyesClosed)
	},
	blink(duration=50){
		this.setNextBlink()
		this.updateEyes(false)
		setTimeout(() => {
			this.updateEyes(true)
		}, duration)
	},
	updateEyes(open){
		if(this.head === null) return
		if(this.head.eyesClosed !== null){
			this.head.eyesClosed.visible = !open
		}
		if(this.head.eyesOpened !== null){
			this.head.eyesOpened.visible = open
		}
	},
	setNextBlink(){
		this.nextBlink = new Date(new Date().getTime() + 2000 + (Math.random() * 8000))
	},
	shouldBlink(){
		if(!this.nextBlink){
			return false
		}
		return new Date().getTime() > this.nextBlink.getTime()
	},
	updateMouth(level){
		// level will range from 0 to 1, with 1 being the loudest
		if(this.head === null) return
		if(this.head.mouthClosed) this.head.mouthClosed.visible = false
		spaciblo.input.throttledConsoleLog('mid', this.head.mouthMid)
		if(this.head.mouthMid) this.head.mouthMid.visible = false
		if(this.head.mouthOpened) this.head.mouthOpened.visible = false
		if(level < 0.1 && this.head.mouthClosed){
			this.head.mouthClosed.visible = true
		} else if(level < 0.5 && this.head.mouthMid){
			this.head.mouthMid.visible = true
		} else if(this.head.mouthOpened){
			this.head.mouthOpened.visible = true
		}
	},
	_enableShadows: function(node){
		if(node.type === 'Mesh'){
			node.castShadow = true
			node.receiveShadow = true
		}
		if(Array.isArray(node.children)){
			for(let child of node.children){
				this._enableShadows(child)
			}
		}
	},
	_makePointerLine: function(){
		// Return a THREE.Line to point out from leftHand or rightHand
		let material = new THREE.LineBasicMaterial({ color: 0x0000ff })
		let geometry = new THREE.Geometry()
		geometry.vertices.push(
			new THREE.Vector3(0, 0, 0),
			new THREE.Vector3(0, 0, -1000)
		)
		return new THREE.Line(geometry, material)
	},
	updateAvatars: function(audioManager){
		for(let child of this.children){
			if(child.isAvatar && child.head && child.head.visible){
				child.updateMouth(audioManager.getRemoteUserLevel(child.settings.clientUUID))
				if(child.shouldBlink()) child.blink()
			}
		}
	},
	interpolate: function(elapsedTime){
		const delta = elapsedTime - this.lastUpdate
		if(delta > 0){
			if(this.rotationMotion.length() != 0){
				this.quaternion.copy(this.updateQuaternion)
				spaciblo.three.WORKING_QUAT.setFromAxisAngle(spaciblo.three.X_AXIS, this.rotationMotion.x * delta)
				this.quaternion.multiply(spaciblo.three.WORKING_QUAT)
				spaciblo.three.WORKING_QUAT.setFromAxisAngle(spaciblo.three.Y_AXIS, this.rotationMotion.y * delta)
				this.quaternion.multiply(spaciblo.three.WORKING_QUAT)
				spaciblo.three.WORKING_QUAT.setFromAxisAngle(spaciblo.three.Z_AXIS, this.rotationMotion.z * delta)
				this.quaternion.multiply(spaciblo.three.WORKING_QUAT)
				this.updateMatrixWorld()
			}
			if(this.translationMotion.length() != 0){
				// Origin
				spaciblo.three.WORKING_VECTOR3.set(0,0,0)
				// Get orientation vector
				spaciblo.three.WORKING_VECTOR3_2.set(0,0,-1)
				spaciblo.three.WORKING_VECTOR3_2.applyQuaternion(this.quaternion)
				spaciblo.three.WORKING_VECTOR3_2.normalize()
				// Get rotation matrix from origin to orientation vector
				spaciblo.three.WORKING_MATRIX4.lookAt(spaciblo.three.WORKING_VECTOR3, spaciblo.three.WORKING_VECTOR3_2, spaciblo.three.Y_AXIS)

				spaciblo.three.WORKING_VECTOR3.copy(this.translationMotion)
				// Scale the motion by delta
				spaciblo.three.WORKING_VECTOR3.multiplyScalar(delta)
				// Apply rotation matrix to translation motion
				spaciblo.three.WORKING_VECTOR3.applyMatrix4(spaciblo.three.WORKING_MATRIX4)
				// Then set this position to the last update position added with the rotated, delta scaled translation motion vector
				this.position.set(this.updatePosition.x + spaciblo.three.WORKING_VECTOR3.x, this.updatePosition.y + spaciblo.three.WORKING_VECTOR3.y, this.updatePosition.z + spaciblo.three.WORKING_VECTOR3.z)
			}
		}

		for(let child of this.children){
			if(typeof child.interpolate == 'function'){
				child.interpolate(elapsedTime)
			}
		}
	}
})

/*
Renders a single template instead of an entire space
*/
spaciblo.three.TemplateRenderer = k.eventMixin(class {
	constructor(dataObject){
		this.cleanedUp = false
		this.boundingBox = null
		this.dataObject = dataObject
		this.rootGroup = new spaciblo.three.Group()
		this.rootGroup.position.set(0, 0, -10)
		this.templateLoader = new spaciblo.three.TemplateLoader()

		this.ambientLight = new THREE.AmbientLight(0xffffff, 1)
		this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.6)
		this.directionalLightDirection = [-0.5, 1, -0.5]
		this.directionalLight.target.position.set(...this.directionalLightDirection)
		this.directionalLight.add(this.directionalLight.target)

		this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 10000)

		this.scene = new THREE.Scene()
		this.scene.add(this.ambientLight)
		this.scene.add(this.directionalLight)
		this.scene.add(this.rootGroup)
		this.width = 0
		this.height = 0

		this.renderer = new THREE.WebGLRenderer({
			antialias: true
		})
		this.renderer.setPixelRatio(window.devicePixelRatio)
		this.renderer.domElement.setAttribute('class', 'three-js-template-renderer')
		this.renderer.setClearColor(spaciblo.three.DEFAULT_BACKGROUND_COLOR)
		this.orbitControls = new THREE.OrbitControls(this.camera, this.renderer.domElement)
		this.orbitControls.enableZoom = false

		this.rootGroup.updateTemplate(this.dataObject.get('uuid'), this.templateLoader)
		this.initializePosition()

		this._boundAnimate = this._animate.bind(this) // Since we use this in every frame, bind it once
		this._animate()
	}
	get el(){
		return this.renderer.domElement
	}
	reloadTemplate(){
		this.rootGroup.updateTemplate(spaciblo.api.RemoveKeyIndicator, this.templateLoader)
		this.templateLoader.removeTemplate(this.dataObject.get('uuid'))
		this.rootGroup.updateTemplate(this.dataObject.get('uuid'), this.templateLoader)
	}
	initializePosition(){
		this.findBoundingBox().then(() => {
			if(this.boundingBox === null) return
			this.boundingBox.getSize(spaciblo.three.WORKING_VECTOR3)
			let maxDimension = Math.max(...spaciblo.three.WORKING_VECTOR3.toArray())
			this.boundingBox.getCenter(spaciblo.three.WORKING_VECTOR3_2)
			this.rootGroup.position.set(spaciblo.three.WORKING_VECTOR3_2.x * -0.5, spaciblo.three.WORKING_VECTOR3_2.y * -0.5, spaciblo.three.WORKING_VECTOR3_2.z * -0.5)
			this.camera.position.set(0, 0, Math.max(maxDimension * 2, 1))
		})
	}
	findBoundingBox(){
		return new Promise((resolve, reject) => {
			if(this.rootGroup.template.loading === true){
				this.rootGroup.template.addListener(() => {
					if(this.rootGroup.template.group){
						this.boundingBox = new THREE.Box3().setFromObject(this.rootGroup.template.group)
					} else {
						this.boundingBox = null
					}
					resolve()
				}, spaciblo.three.events.TemplateLoaded, true)
			} else {
				if(this.rootGroup.template.group){
					this.boundingBox = new THREE.Box3().setFromObject(this.rootGroup.template.group)
				} else {
					this.boundingBox = null
				}
				resolve()
			}
		})
	}
	setSize(width, height){
		this.width = width
		this.height = height
		this.renderer.setPixelRatio(window.devicePixelRatio)
		this.camera.aspect = this.width / this.height
		this.camera.updateProjectionMatrix()
		this.renderer.setSize(this.width, this.height, false)
	}
	cleanup(){
		this.cleanedUp = true
	}
	_animate(){
		if(this.cleanedUp) return
		requestAnimationFrame(this._boundAnimate)
		this.rootGroup.updateMatrixWorld(true)
		this.renderer.autoClear = true
		this.scene.matrixAutoUpdate = true
		THREE.GLTFLoader.Shaders.update(this.scene, this.camera)
		this.orbitControls.update()
		this.renderer.render(this.scene, this.camera)
	}
})

// returns a serializeable data structure representing an intersect received from a ray caster
spaciblo.three.serializeIntersect = function(intersect){
	let results = {
		distance: intersect.distance,
		point: [intersect.point.x, intersect.point.y, intersect.point.z],
		object: spaciblo.three.serializeGroup(intersect.object),
		face: {
			a: intersect.face.a,
			b: intersect.face.b,
			c: intersect.face.c,
			normal: [intersect.face.normal.x, intersect.face.normal.y, intersect.face.normal.z]
		}
	}
	return results
}

// returns a serializable data structure representing a Three.Group or spaciblo.three.Group
spaciblo.three.serializeGroup = function(group){
	let results = {
		name: group.name,
		id: group.state ? group.state.id : null,
		settings: group.settings || null,
		templateUUID: group.template ? group.template.get('uuid') : null,
		position: [group.position.x, group.position.y, group.position.z],
		orientation: [group.quaternion.x, group.quaternion.y, group.quaternion.z, group.quaternion.w],
		rotation: group.rotationMotion ? [group.rotationMotion.x, group.rotationMotion.y, group.rotationMotion.z] : [0,0,0],
		translation: group.translationMotion ? [group.translationMotion.x, group.translationMotion.y, group.translationMotion.z] : [0,0,0],
		scale: [group.scale.x, group.scale.y, group.scale.z],
		children: []
	}
	if(group.material){
		results.material = {
			name: group.material.name
		}
		if(group.material.specular) results.material.specular = group.material.specular.toArray()
		if(group.material.color) results.material.color = group.material.color.toArray()
	}
	for(let child of group.children){
		results.children.push(spaciblo.three.serializeGroup(child))
	}
	return results
}

spaciblo.three.findChildNodeByName = function(name, node, deepSearch=true, results=[]){
	if(typeof node.children === 'undefined'){
		return results
	}
	for(let child of node.children){
		if(child.name === name){
			results.push(child)
		}
		if(deepSearch){
			spaciblo.three.findChildNodeByName(name, child, true, results)
		}
	}
	return results
}

spaciblo.three.OBJLoader = class {
	static load(baseURL, geometry){
		return new Promise(function(resolve, reject){
			const mtlLoader = new THREE.MTLLoader()
			mtlLoader.setPath(baseURL)
			const mtlName = geometry.split('.')[geometry.split(':').length - 1] + '.mtl'
			mtlLoader.load(mtlName, (materials) => {
				materials.preload()
				let objLoader = new THREE.OBJLoader()
				objLoader.setMaterials(materials)
				objLoader.setPath(baseURL)
				objLoader.load(geometry, (obj) => {
					resolve(obj)
				}, () => {} , (...params) => {
					console.error('Failed to load obj', ...params)
					reject(...params)
				})
			})
		})
	}
}

spaciblo.three.GLTFLoader = class {
	static load(url){
		return new Promise(function(resolve, reject){
			let loader = new THREE.GLTFLoader()
			loader.load(url, (gltf) => {
				/*
				if (gltf.animations && gltf.animations.length) {
					for (let i = 0; i < gltf.animations.length; i++) {
						gltf.animations[i].loop = true
						gltf.animations[i].play()
					}
				}
				*/
				resolve(gltf)
			})
		})
	}
}