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

spaciblo.three.events.GLTFLoaded = 'three-gltf-loaded' 

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
		this.scene.add(this.flockGroup)

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

		this.objectMap = new Map() // object id -> spaciblo.three.Group

		// These variables are used in _animate to handle motion
		this.cameraOrientationVector = new THREE.Vector3()	
		this.cameraRotationQuaternion = new THREE.Quaternion()		
		this.translationVector = new THREE.Vector3()
		this.rotationEuler = new THREE.Euler(0,0,0,'XYZ')

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

		this.el.addEventListener('mousemove', this._onMouseMove.bind(this), false)
		this.el.addEventListener('click', this._onMouseClick.bind(this), false)
		this._boundAnimate = this._animate.bind(this) // Since we use this in every frame, bind it once
		this._animate()
	}

	get inputRotation() { return this._inputRotation }
	set inputRotation(value){ this._inputRotation = [...value] }

	get inputTranslation() { return this._inputTranslation }
	set inputTranslation(value){ this._inputTranslation = [...value] }

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
	_toggleFlock(){
		if(this.flockIsLoaded){
			this.flockGroup.visible = !this.flockGroup.visible
			return
		}

		// Is there an active flock? If not, do nothing
		this.activeFlock = this.flocks.getActiveFlock()
		if(this.activeFlock === null){
			console.error('No active flock')
			return
		}

		// Load the active flock
		this.flockIsLoaded = true
		this.flockGroup.visible = true
		this.activeFlock.getMembers().fetch().then(() => {
			for(let member of this.activeFlock.getMembers()){
				this.flockGroup.add(this._createGroupFromFlockMember(member))
			}
		}).catch(err => {
			console.error('Error fetching flock members', err)
		})
	}
	setFollowGroup(followerId, leaderId=-1, local=false){
		let followerGroup = this.objectMap.get(followerId) || null
		spaciblo.input.throttledConsoleLog('followerGroup', followerId, leaderId, followerGroup)
		if(leaderId === -1 || leaderId === null){
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
				leader: -1,
				position: [followerGroup.position.x, followerGroup.position.y, followerGroup.position.z],
				orientation: [followerGroup.quaternion.x, followerGroup.quaternion.y, followerGroup.quaternion.z, followerGroup.quaternion.w],
				rotation: [followerGroup.rotationMotion.x, followerGroup.rotationMotion.y, followerGroup.rotationMotion.z],
				translation: [followerGroup.translationMotion.x, followerGroup.translationMotion.y, followerGroup.translationMotion.z],
				scale: [followerGroup.scale.x, followerGroup.scale.y, followerGroup.scale.z],
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
		followerGroup.rotationMotion.set(0,0,0)
		followerGroup.translationMotion.set(0,0,0)

		// Save the follower's world position and orientation relative to the leader
		// We'll use this info in _animate to move the follower relative to the leader

		// Create a group in the leader group that is in the same current orientation and position as the follower group
		followerGroup.leaderGroupShadow = new THREE.Group()
		followerGroup.leaderGroupShadow.name = 'leader group shadow'
		followerGroup.leaderGroupShadow.local = local
		leaderGroup.add(followerGroup.leaderGroupShadow)

		followerGroup.getWorldQuaternion(spaciblo.three.WORKING_QUAT)
		spaciblo.three.WORKING_QUAT_2.setFromRotationMatrix(leaderGroup.matrixWorld)
		followerGroup.leaderGroupShadow.quaternion.multiplyQuaternions(spaciblo.three.WORKING_QUAT_2, spaciblo.three.WORKING_QUAT)
		if(local){
			followerGroup.leaderGroupShadow.quaternion.inverse()
		}

		spaciblo.three.WORKING_VECTOR3.copy(followerGroup.position)
		followerGroup.parent.localToWorld(spaciblo.three.WORKING_VECTOR3)
		leaderGroup.worldToLocal(spaciblo.three.WORKING_VECTOR3)
		followerGroup.leaderGroupShadow.position.copy(spaciblo.three.WORKING_VECTOR3)

		return {
			id: followerId,
			leader: leaderId,
			position: [followerGroup.position.x, followerGroup.position.y, followerGroup.position.z],
			orientation: [followerGroup.quaternion.x, followerGroup.quaternion.y, followerGroup.quaternion.z, followerGroup.quaternion.w],
			rotation: [followerGroup.rotationMotion.x, followerGroup.rotationMotion.y, followerGroup.rotationMotion.z],
			translation: [followerGroup.translationMotion.x, followerGroup.translationMotion.y, followerGroup.translationMotion.z],
			scale: [followerGroup.scale.x, followerGroup.scale.y, followerGroup.scale.z],
		}
	}
	_updateFollowingGroups(group=this.rootGroup){
		if(group === null) return
		if(group.leaderGroup){
			group.leaderGroupShadow.getWorldQuaternion(spaciblo.three.WORKING_QUAT)
			spaciblo.three.WORKING_QUAT_2.setFromRotationMatrix(group.parent.matrixWorld)
			group.quaternion.multiplyQuaternions(spaciblo.three.WORKING_QUAT_2, spaciblo.three.WORKING_QUAT)
			if(group.leaderGroupShadow.local){
				group.quaternion.inverse()
			}
			group.leaderGroupShadow.getWorldPosition(spaciblo.three.WORKING_VECTOR3)
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
			this.workerManager.handleGroupDeleted(deletion)
		}
	}
	_createGroupFromFlockMember(flockMember){
		let group = new spaciblo.three.Group(this.workerManager)
		group.name = 'flock member'
		group.flockMember = flockMember
		group.renderer = this
		group.position.set(...flockMember.getFloatArray('position', [0,0,0]))
		group.updatePosition.set(...flockMember.getFloatArray('position', [0,0,0]))
		group.quaternion.set(...flockMember.getFloatArray('orientation', [0,0,0,1]))
		group.updateQuaternion.set(...flockMember.getFloatArray('orientation', [0,0,0,1]))
		group.rotation.set(...flockMember.getFloatArray('rotation', [0,0,0]))
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

			// Apply reversed input rotation to the pivot point
			this.rotationEuler.fromArray([
				this._inputRotation[0] * -delta,
				this._inputRotation[1] * -delta,
				this._inputRotation[2] * -delta
			])
			this.cameraRotationQuaternion.setFromEuler(this.rotationEuler)
			this.pivotPoint.quaternion.multiply(this.cameraRotationQuaternion)
			this.pivotPoint.updateMatrixWorld()

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
			spaciblo.three.WORKING_QUAT.copy(this.pivotPoint.quaternion)
			spaciblo.three.WORKING_QUAT.inverse()
			this.avatarGroup.quaternion.copy(spaciblo.three.WORKING_QUAT)

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
		}

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
					spaciblo.three.WORKING_EULER.setFromQuaternion(this.avatarGroup.head.quaternion)
					spaciblo.three.WORKING_EULER.x = 0
					spaciblo.three.WORKING_EULER.z = 0
					this.avatarGroup.torso.quaternion.setFromEuler(spaciblo.three.WORKING_EULER)
				}

				// Update the hands
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
		this.fetchQueue = [] 		// Templates whose metadata we will fetch
		this.loadedTemplates = [] 	// Templates whose metadata is fetched
	}
	addTemplate(templateUUID){
		let [index, listName, array] = this._indexAndListForTemplate(templateUUID)
		if(index !== -1){
			return array[index]
		}
		// It's an unknown template, so fetch it
		let template = new be.api.Template({ uuid: templateUUID })
		template.loading = true
		this.fetchQueue.push(template)
		template.fetch().then(() =>{
			this.fetchQueue.splice(this.fetchQueue.indexOf(template), 1)
			template.loading = false
			this.loadedTemplates.push(template)
		}).catch((err) => {
			this.fetchQueue.splice(this.fetchQueue.indexOf(template), 1)
			template.loading = false
			this.loadedTemplates.push(template)
		})
		return template
	}
	_indexAndListForTemplate(templateUUID){
		// returns [index,fetch/load/loaded,array] for a template or [-1, null, null] if it isn't known
		for(let i = 0; i < this.fetchQueue.length; i++){
			if(this.fetchQueue[i].get('uuid') == templateUUID){
				return [i, 'fetch', this.fetchQueue]
			}
		}
		for(let i = 0; i < this.loadedTemplates.length; i++){
			if(this.loadedTemplates[i].get('uuid') == templateUUID){
				return [i, 'loaded', this.loadedTemplates]
			}
		}
		return [-1, null, null]
	}
})

spaciblo.three.Group = function(workerManager){
	THREE.Group.call(this)
	this.workerManager = workerManager
	this.lastUpdate = null									// time in milliseconds of last update
	this.updatePosition = new THREE.Vector3(0,0,0) 			// The position recieved from the sim
	this.updateQuaternion = new THREE.Quaternion(0,0,0,1) 	// the orientation receive from the sim
	this.rotationMotion = new THREE.Vector3(0,0,0)			// the rotation motion received from the sim
	this.translationMotion = new THREE.Vector3(0,0,0)		// the translation motion received from the sim

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
}
spaciblo.three.Group.prototype = Object.assign(Object.create(THREE.Group.prototype), {
	serializeForWorker: function(){
		// returns a serializable data structure to hand to client side scripts running in web workers
		let results = {
			name: this.name,
			id: this.state.id,
			templateUUID: this.template ? this.template.get('uuid') : null,
			position: [this.position.x, this.position.y, this.position.z],
			orientation: [this.quaternion.x, this.quaternion.y, this.quaternion.z, this.quaternion.w],
			rotation: [this.rotationMotion.x, this.rotationMotion.y, this.rotationMotion.z],
			translation: [this.translationMotion.x, this.translationMotion.y, this.translationMotion.z],
			scale: [this.scale.x, this.scale.y, this.scale.z],
			children: []
		}
		for(let child of this.children){
			if(typeof child.serializeForWorker === 'function'){
				results.children.push(child.serializeForWorker())
			}
		}
		return results
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
		if(this.templateNode){
			this.remove(this.templateNode)
			this.workerManager.handleTemplateUnset(this.state.id, this.templateNode.templateUUID)
			this.templateNode = null
		}
		if(templateUUID == spaciblo.api.RemoveKeyIndicator){
			// We already removed the Template and this value indicates that there is no more template.
			return
		}

		this.template = templateLoader.addTemplate(templateUUID)
		this.worker = this.workerManager.getOrCreateTemplateWorker(this.template)

		var loadIt = (loadingGroup) => {
			const extension = loadingGroup.template.getGeometryExtension()
			const templateUUID = loadingGroup.template.get('uuid')
			if(extension === 'gltf'){
				spaciblo.three.GLTFLoader.load(loadingGroup.template.geometryURL()).then(gltf => {
					loadingGroup.setGLTF(gltf, templateUUID)
				}).catch(err => {
					console.error('Could not fetch gltf', err)
				})
			} else if(extension === 'obj'){
				spaciblo.three.OBJLoader.load(loadingGroup.template.getBaseURL(), loadingGroup.template.get('geometry')).then(obj => {
					loadingGroup.setOBJ(obj, templateUUID)
				}).catch(err => {
					console.error('Could not fetch obj', err)
				})
			} else {
				console.error('Unknown extension for template geometry.', extension, loadingGroup.template)
			}
			loadingGroup.worker.handleTemplateGroupAdded(loadingGroup)
		}

		if(this.template.loading === false){
			loadIt(this)
		} else {
			this.template.addListener(() => {
				loadIt(this)
			}, 'fetched', true)
		}
	},
	updateSettings: function(settings){
		if(typeof settings !== 'object') return
		this.settings = Object.assign(this.settings || {}, settings)
		for(let setting in this.settings){
			if(this.settings[setting] == spaciblo.api.RemoveKeyIndicator){
				delete this.settings[setting]
			}
		}
		if(this.settings.name){
			this.name = this.settings.name
		}
		if(typeof this.settings['light-type'] === 'string'){
			if(this.settingsLight){
				this.remove(this.settingsLight)
				if(this.settingsLight.target){
					this.remove(this.settingsLight.target)
				}
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
	},
	setGLTF: function(gltf, templateUUID){
		this.templateNode = gltf.scene
		this.templateNode.templateUUID = templateUUID
		this.add(gltf.scene)
	},
	setOBJ: function(obj, templateUUID){
		//this._enableShadows(obj)
		this.templateNode = obj
		this.templateNode.templateUUID = templateUUID
		this.add(this.templateNode)
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