"use strict"

var spaciblo = spaciblo || {}
spaciblo.three = spaciblo.three || {}
spaciblo.three.events = spaciblo.three.events || {}

spaciblo.three.UPDATE_DELTA = 0.1 // seconds between sim updates 

spaciblo.three.X_AXIS = new THREE.Vector3(1,0,0)
spaciblo.three.Y_AXIS = new THREE.Vector3(0,1,0)
spaciblo.three.Z_AXIS = new THREE.Vector3(0,0,1)

spaciblo.three.WORKING_QUAT = new THREE.Quaternion(0,0,0,1) // A handy quat so we don't need to allocate new ones in each frame

spaciblo.three.events.GLTFLoaded = 'three-gltf-loaded' 

/*
SpacesRenderer holds a Three.js scene and is used by SpacesComponent to render spaces
*/
spaciblo.three.Renderer = k.eventMixin(class {
	constructor(inputManager, background=new THREE.Color(0x99DDff)){
		this.inputManager = inputManager
		this.rootGroup = null; // The spaciblo.three.Group at the root of the currently active space scene graph
		this.templateLoader = new spaciblo.three.TemplateLoader()
		this.clock = new THREE.Clock()
		this.scene = new THREE.Scene()
		this.scene.background = background
		this.camera = new THREE.PerspectiveCamera(75, 1, 0.5, 10000)

		this.width = 0
		this.height = 0

		// These will be set iff this.setVRDisplay is called with a non-null parameter 
		this.vrDisplay = null
		this.vrFrameData = null
		this.firstVRFrame = true

		this.objectMap = new Map() // object id -> spaciblo.three.Group

		// These variables are used in _animate to determine keyboard motion and whether or not to trigger events
		this.translationVector = new THREE.Vector3()	// meters per second on x, y, z axis 
		this.rotationVector = new THREE.Vector3()		// radians/second around x, y, z axis
		this.currentTranslation = 0
		this.currentRotation = 0
		this.previousTranslation = 0
		this.previousRotation = 0

		this.ambientLight = new THREE.AmbientLight(0xdddddd, 0.1)
		this.scene.add(this.ambientLight)

		this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6)
		this.hemiLight.color.setHSL(0.6, 0.6, 0.6)
		this.hemiLight.groundColor.setHSL(1, 1, 1)
		this.hemiLight.position.set(0, 500, 0)
		this.scene.add(this.hemiLight)

		this.dirLight = new THREE.DirectionalLight(0xffffff, 1)
		this.dirLight.color.setHSL(1, 1, 1)
		this.dirLight.position.set(-1, 1.75, 1)
		this.dirLight.position.multiplyScalar(50)
		this.scene.add(this.dirLight)

		this.defaultSky = this._createDefaultSky() 
		this.scene.add(this.defaultSky)

		this.raycaster = new THREE.Raycaster()
		this.mouse = new THREE.Vector2()
		this.intersectedObj = null

		this.renderer = new THREE.WebGLRenderer()
		this.renderer.sortObjects = false
		this.renderer.antialias = true
		this.renderer.setClearColor(0xffffff)
		this.renderer.domElement.setAttribute('class', 'three-js-spaces-renderer spaces-renderer')

		// A list of spaces to show when no space is loaded
		this.spaces = []
		this.spaceMenuMeshes = []
		this.spaceMenu = new THREE.Group()
		this.spaceMenu.name = "Space Menu"
		this.spaceMenu.position.z = -8
		this.scene.add(this.spaceMenu)

		this.el.addEventListener('mousemove', this._onDocumentMouseMove.bind(this), false)
		this.el.addEventListener('click', this._onClick.bind(this), false)
		this._boundAnimate = this._animate.bind(this) // Since we use this in every frame, bind it once
		this._animate()
	}
	_onClick(ev){
		ev.preventDefault()
		if(this.intersectedObj == null) return
		if(typeof this.intersectedObj.space !== "undefined"){
			this.trigger(spaciblo.events.SpaceSelected, this.intersectedObj.space)
		}
	}
	_onDocumentMouseMove(ev){
		ev.preventDefault()
		let [offsetX, offsetY] = k.documentOffset(this.renderer.domElement)
		this.mouse.x = ((ev.clientX - offsetX) / this.el.offsetWidth) * 2 - 1
		this.mouse.y = - ((ev.clientY - offsetY) / this.el.offsetHeight) * 2 + 1
	}
	_createDefaultSky(){
		let vertexShader = document.getElementById('skyVertexShader').textContent
		let fragmentShader = document.getElementById('skyFragmentShader').textContent
		let uniforms = {
			topColor:    { value: new THREE.Color( 0x0077ff ) },
			bottomColor: { value: new THREE.Color( 0xffffff ) },
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
		return new THREE.Mesh( skyGeo, skyMat )
	}
	setVRDisplay(vrDisplay) {
		if(vrDisplay !== null){
			if(this.vrFrameData === null){
				this.vrFrameData = new VRFrameData()
			}
			if(this.firstVRFrame === false){
				this.firstVRFrame = true
			}
			// TODO make the sky gradient work in VR
			this.scene.remove(this.defaultSky)
			this.scene.background = null
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
	updateSpace(nodeUpdates=[], additions=[], deletions=[]) {
		nodeUpdates = nodeUpdates || []
		additions = additions || []
		deletions = deletions || []
		for(let addition of additions){
			if(this.objectMap.has(addition.id)){
				continue
			}
			if(addition.id === 0){
				var parent = null
			} else {
				var parent = this.objectMap.get(addition.parent)
				if(typeof parent === "undefined") {
					console.error("Tried to add to an unknown parent", addition)
					continue
				}
			}
			let group = this._createGroupFromAddition(addition)
			group.lastUpdate = this.clock.elapsedTime + spaciblo.three.UPDATE_DELTA
			this.objectMap.set(addition.id, group)
			if(addition.id == 0){
				// This is the root
				this.rootGroup = group
				this.hideSpaceMenu()
				this.scene.add(this.rootGroup)
			} else {
				parent.add(group)
			}
		}
		for(let deletion of deletions){
			var group = this.objectMap.get(deletion)
			if(typeof group === "undefined"){
				continue
			}
			this.objectMap.delete(deletion)
			if(group.parent){
				group.parent.remove(group)
			} else {
				this.scene.remove(group)
			}
		}
		for(let update of nodeUpdates){
			let group = this.objectMap.get(update.id)
			if(typeof group === "undefined"){
				console.error("Tried to update unknown object", update)
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
		}
	}
	_createGroupFromAddition(state){
		let group = new spaciblo.three.Group()
		if(typeof state.id != "undefined"){
			this.objectMap.set(state.id, group)
		}
		group.renderer = this
		group.state = state
		if(state.settings && state.settings.name && state.settings.name.value){
			group.name = state.settings.name.value
		}
		if(state.position){
			group.position.set(...state.position)
		}
		if(state.orientation){
			group.quaternion.set(...state.orientation)
		}
		if(state.scale){
			group.scale.set(...state.scale)
		}
		if(typeof state.templateUUID !== "undefined" && state.templateUUID.length > 0){
			group.template = this.templateLoader.addTemplate(state.templateUUID)
			// TODO figure out why we can't clone glTF
			var loadIt = function(){
				const extension = group.template.getSourceExtension()
				if(extension == null){
					console.error('Template had no source extension', group.template)
				} else if(extension == 'gltf'){
					spaciblo.three.GLTFLoader.load(group.template.sourceURL()).then(gltf => {
						group.setGLTF(gltf)
					}).catch(err => {
						console.error("Could not fetch gltf", err)
					})
				} else if(extension == 'obj'){
					spaciblo.three.OBJLoader.load(group.template.getBaseURL(), group.template.get('source')).then(obj => {
						group.setOBJ(obj)
					}).catch(err => {
						console.error("Could not fetch obj", err)
					})
				}
			}

			if(group.template.loading === false){
				loadIt()
			} else {
				group.template.addListener(() => {
					loadIt()
				}, "fetched", true)
			}
		}

		if(typeof state.nodes !== "undefined"){
			for(let node of state.nodes){
				group.add(this._createGroupFromAddition(node))
			}
		}
		return group
	}
	hideSpaceMenu(){
		this.spaceMenu.visible = false;	
	}
	clearSpacesMenu(){
		while(this.spaceMenuMeshes.length > 0){
			this._removeSpaceMesh(0, false)
		}
	}
	removeSpaceFromMenu(space, layout=true){
		const index = this._indexOfSpaceInMenu(space)
		if(index === -1) return
		this._removeSpaceMesh(index, layout)
	}
	_removeSpaceMesh(index, layout=true){
		this.spaceMenu.remove(this.spaceMenuMeshes[index])
		this.spaceMenuMeshes[index].space = null
		this.spaceMenuMeshes.splice(index, 1)
		if(layout){
			this.layoutSpaceMenu()
		}
	}
	_indexOfSpaceInMenu(space){
		for(let i in this.spaceMenuMeshes){
			if(this.spaceMenuMeshes[i].space.equals(space)){
				return i
			}
		}
		return -1
	}
	addSpaceToMenu(space, layout=true){
		if(this._indexOfSpaceInMenu(space) !== -1) return
		const geometry = new THREE.BoxBufferGeometry(1, 1, 1)
		const material = new THREE.MeshPhongMaterial({ 
			color: new THREE.Color(0xFFDD99),
			shading: THREE.SmoothShading
		})
		const mesh = this._addGeometry(geometry, material)
		mesh.space = space
		this.spaceMenuMeshes.push(mesh)
		this.spaceMenu.add(mesh)
		if(layout){
			this.layoutSpaceMenu()
		}
	}
	layoutSpaceMenu(){
		if(this.spaceMenuMeshes.length == 0) return
		const distanceBetweenSpaceMenuItems = 2
		let currentX = (this.spaceMenuMeshes.length - 1) * distanceBetweenSpaceMenuItems * -1
		currentX = currentX / 2
		for(let mesh of this.spaceMenuMeshes){
			mesh.position.x = currentX
			mesh.position.y = 0
			mesh.position.z = 0
			currentX += distanceBetweenSpaceMenuItems
		}
	}
	_animateSpaceMenu(delta){
		for(let mesh of this.spaceMenuMeshes){
			mesh.rotation.y += 0.5 * delta
			mesh.rotation.x -= 0.5 * delta
		}
	}
	_animate(){
		let delta = this.clock.getDelta()
		if(this.vrDisplay){
			this.vrDisplay.requestAnimationFrame(this._boundAnimate)
			// We can't render to VR if we're in the window's animation frame call, so punt to the next frame which will be from the VR display's frame call
			if(this.firstVRFrame){
				this.firstVRFrame = false
				return
			}
		} else {
			requestAnimationFrame(this._boundAnimate)
		}

		this.previousRotation = this.currentRotation
		this.previousTranslation = this.currentTranslation
		if(this.inputManager.isDown(spaciblo.components.KeyMap.get('left-arrow')) && this.inputManager.isDown(spaciblo.components.KeyMap.get('right-arrow')) == false){
			this.currentRotation = this.inputManager.keyboardRotationDelta
		} else if(this.inputManager.isDown(spaciblo.components.KeyMap.get('right-arrow')) && this.inputManager.isDown(spaciblo.components.KeyMap.get('left-arrow')) == false){
			this.currentRotation = -1 * this.inputManager.keyboardRotationDelta
		} else {
			this.currentRotation = 0
		}
		if(this.currentRotation != 0){
			this.camera.rotateY(this.currentRotation * delta)
		}

		if(this.inputManager.isDown(spaciblo.components.KeyMap.get('up-arrow')) && this.inputManager.isDown(spaciblo.components.KeyMap.get('down-arrow')) == false){
			this.currentTranslation = this.inputManager.keyboardTranslationDelta
		} else if(this.inputManager.isDown(spaciblo.components.KeyMap.get('down-arrow')) && this.inputManager.isDown(spaciblo.components.KeyMap.get('up-arrow')) == false){
			this.currentTranslation = -1 * this.inputManager.keyboardTranslationDelta			
		} else {
			this.currentTranslation = 0
		}
		if(this.currentTranslation != 0){
			this.camera.getWorldDirection(this.translationVector)
			this.translationVector.multiplyScalar(this.currentTranslation * delta)
			this.camera.position.add(this.translationVector)
		}

		// Trigger an AvatarMotionChanged event if necessary
		if(this.currentRotation != this.previousRotation || this.currentTranslation != this.previousTranslation){
			// Reset the translationVector to the absolute speed
			this.camera.getWorldDirection(this.translationVector)
			this.translationVector.multiplyScalar(this.currentTranslation)
			this.rotationVector.set(0, this.currentRotation, 0)
			this.trigger(spaciblo.events.AvatarMotionChanged, this.camera.position, this.camera.quaternion, this.translationVector, this.rotationVector)
		}

		this._animateSpaceMenu(delta)
		if(this.rootGroup){
			this.rootGroup.interpolate(this.clock.elapsedTime)
		}
		this.camera.updateMatrixWorld()

		if(this.spaceMenu && this.spaceMenu.visible){
			this.raycaster.setFromCamera(this.mouse, this.camera)
			let intersects = this.raycaster.intersectObjects(this.scene.children, true)
			if(intersects.length > 0){
				if(this.intersectedObj !== intersects[0].object && intersects[0].object.material.emissive){
					if(this.intersectedObj !== null){
						this.intersectedObj.material.emissive.setHex(this.intersectedObj.currentHex)
					}
					this.intersectedObj = intersects[0].object
					this.intersectedObj.currentHex = this.intersectedObj.material.emissive.getHex()
					this.intersectedObj.material.emissive.setHex(0xff0000)
				}
			} else {
				if(this.intersectedObj !== null){
					this.intersectedObj.material.emissive.setHex(this.intersectedObj.currentHex)
					this.intersectedObj = null
				}
			}
		}

		if(this.vrDisplay){
			this.vrDisplay.getFrameData(this.vrFrameData)
			this.renderer.autoClear = false
			this.scene.matrixAutoUpdate = false

			// The view is assumed to be full-window in VR
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

			this.vrDisplay.submitFrame();
		} else {
			this.renderer.autoClear = true
			this.scene.matrixAutoUpdate = true
			//THREE.GLTFLoader.Animations.update()
			THREE.GLTFLoader.Shaders.update(this.scene, this.camera);		
			this.renderer.render(this.scene, this.camera)
		}

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
				return [i, "fetch", this.fetchQueue]
			}
		}
		for(let i = 0; i < this.loadedTemplates.length; i++){
			if(this.loadedTemplates[i].get('uuid') == templateUUID){
				return [i, "loaded", this.loadedTemplates]
			}
		}
		return [-1, null, null]
	}
})

spaciblo.three.Group = function(){
	THREE.Group.call(this)
	this.lastUpdate = null									// time in milliseconds of last update
	this.updatePosition = new THREE.Vector3(0,0,0) 			// The position recieved from the sim
	this.updateQuaternion = new THREE.Quaternion(0,0,0,1) 	// the orientation receive from the sim
	this.rotationMotion = new THREE.Vector3(0,0,0)			// the rotation motion received from the sim
	this.translationMotion = new THREE.Vector3(0,0,0)		// the translation motion received from the sim
}
spaciblo.three.Group.prototype = Object.assign(Object.create(THREE.Group.prototype), {
	setGLTF: function(gltf){
		this.add(gltf.scene)
	},
	setOBJ: function(obj){
		this.add(obj)
	},
	interpolate: function(elapsedTime){
		const delta = elapsedTime - this.lastUpdate
		if(delta > 0){
			if(this.translationMotion.length() != 0){
				this.position.x = this.updatePosition.x + (this.translationMotion.x * delta)
				this.position.y = this.updatePosition.y + (this.translationMotion.y * delta)
				this.position.z = this.updatePosition.z + (this.translationMotion.z * delta)
			}
			if(this.rotationMotion.length() != 0){
				this.quaternion.copy(this.updateQuaternion)
				spaciblo.three.WORKING_QUAT.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.rotationMotion.x * delta)
				this.quaternion.multiply(spaciblo.three.WORKING_QUAT)
				spaciblo.three.WORKING_QUAT.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationMotion.y * delta)
				this.quaternion.multiply(spaciblo.three.WORKING_QUAT)
				spaciblo.three.WORKING_QUAT.setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.rotationMotion.z * delta)
				this.quaternion.multiply(spaciblo.three.WORKING_QUAT)
			}
		}

		for(let child of this.children){
			if(typeof child.interpolate == 'function'){
				child.interpolate(elapsedTime)
			}
		}
	}
})

spaciblo.three.OBJLoader = class {
	static load(baseURL, source){
		return new Promise(function(resolve, reject){
			const mtlLoader = new THREE.MTLLoader()
			mtlLoader.setPath(baseURL)
			const mtlName = source.split('.')[source.split(':').length - 1] + '.mtl'
			mtlLoader.load(mtlName, (materials) => {
				materials.preload()
				let objLoader = new THREE.OBJLoader()
				objLoader.setMaterials(materials)
				objLoader.setPath(baseURL)
				objLoader.load(source, (obj) => {
					resolve(obj)
				}, () => {} , (...params) => {
					console.error("Failed to load obj", ...params)
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