"use strict"

var spaciblo = spaciblo || {}
spaciblo.three = spaciblo.three || {}
spaciblo.three.events = spaciblo.three.events || {}

spaciblo.three.events.GLTFLoaded = 'three-gltf-loaded' 
/*
SpacesRenderer holds a Three.js scene and is used by SpacesComponent to render spaces
*/
spaciblo.three.Renderer = k.eventMixin(class {
	constructor(inputManager, background=new THREE.Color(0x99DDff)){
		this.inputManager = inputManager
		this.spaceUUID = null; // The UUID of the currently active space
		this.rootGroup = null; // The Three.Group at the root of the currently active space scene graph
		this.templateLoader = new spaciblo.three.TemplateLoader()
		this.clock = new THREE.Clock()
		this.scene = new THREE.Scene()
		this.scene.background = background
		this.camera = new THREE.PerspectiveCamera(75, 1, 0.5, 10000)

		// These variables are used in _animate to determine keyboard motion and whether or not to trigger events
		this.translationVector = new THREE.Vector3()	// meters per second on x, y, z axis 
		this.rotationVector = new THREE.Vector3()		// radians/second around x, y, z axis
		this.currentTranslation = 0
		this.currentRotation = 0
		this.previousTranslation = 0
		this.previousRotation = 0

		var light = new THREE.DirectionalLight(0xffffff, 1)
		light.position.set(1, 1, 1).normalize()
		this.scene.add(light)

		this.raycaster = new THREE.Raycaster()
		this.mouse = new THREE.Vector2()
		this.intersectedObj = null

		this.renderer = new THREE.WebGLRenderer()
		this.renderer.sortObjects = false
		this.renderer.setClearColor(0xffffff)
		this.renderer.setPixelRatio(window.devicePixelRatio)
		this.renderer.shadowMap.enabled = true
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
		this.renderer.domElement.setAttribute('class', 'three-js-spaces-renderer spaces-renderer')

		// A list of spaces to show when no space is loaded
		this.spaces = []
		this.spaceMenuMeshes = []
		this.spaceMenu = new THREE.Group()
		this.spaceMenu.name = "Space Menu"
		this.spaceMenu.position.z = -5
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
	setSize(width, height){
		this.camera.aspect = width / height
		this.camera.updateProjectionMatrix()
		this.renderer.setSize(width, height)
	}
	showSpace(spaceUUID, state){
		if(this.spaceUUID !== null){
			console.error("TODO switch from one space to another")
			return
		}
		this.hideSpaceMenu()
		this.spaceUUID = spaceUUID
		if(state.settings && state.settings["background-color"] && state.settings["background-color"].value){
			this.scene.background = new THREE.Color(state.settings["background-color"].value)
		}
		this.rootGroup = this._createGroupFromState(state)
		this.scene.add(this.rootGroup)
	}
	_createGroupFromState(state, parentState=null){
		let group = new spaciblo.three.Group()
		group.renderer = this
		group.state = state
		group.state.parent = parentState
		if(state.settings && state.settings.name && state.settings.name.value){
			group.name = state.settings.name.value
		} else if(parentState == null){
			group.name = "root"
		}
		if(state.orientation){
			group.quaternion.set(...state.orientation.data)
		}
		if(state.position){
			group.position.set(...state.position.data)
		}
		if(state.scale){
			group.scale.set(...state.scale.data)
		}

		if(typeof state.templateUUID !== "undefined" && state.templateUUID.length > 0){
			group.template = this.templateLoader.addTemplate(state.templateUUID)
			/*
			This is convoluted because we are currently unable to clone glTF scenes
			So, if template.gltf is set we use it and set it to null.
			If template.gltf is not set, we fetch and create a new one.
			// TODO figure out why we can't clone glTF
			*/
			if(group.template.loading === false){
				if(group.template.gltf){
					group.setGLTF(group.template.gltf)
					group.template.gltf = null
				} else {
					spaciblo.three.GLTFLoader.load(group.template.gltfURL()).then(gltf => {
						group.setGLTF(gltf)
					}).catch(err => {
						console.error("Could not fetch gltf", err)
					})
				}
			} else {
				group.template.addListener((eventName, template, gltf) => {
					if(group.template.gltf){
						group.setGLTF(group.template.gltf)
						group.template.gltf = null
					} else {
						spaciblo.three.GLTFLoader.load(group.template.gltfURL()).then(gltf => {
							group.setGLTF(gltf)
						}).catch(err => {
							console.error("Could not fetch gltf", err)
						})
					}
				}, spaciblo.three.events.GLTFLoaded, true)
			}
		}

		if(typeof state.nodes !== "undefined"){
			for(let node of state.nodes){
				group.add(this._createGroupFromState(node, state))
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
		requestAnimationFrame(this._boundAnimate)

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
		this.camera.updateMatrixWorld()

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

		//THREE.GLTFLoader.Animations.update();
		THREE.GLTFLoader.Shaders.update(this.scene, this.camera);		
		this.renderer.render(this.scene, this.camera)
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
		this.loadQueue = [] 		// Templates whose glTF we will load
		this.loadedTemplates = [] 	// Templates whose metadata is fetched and glTF is loaded or who have failed to load
		this.loadingTemplate = null 
	}
	addTemplate(templateUUID){
		let [index, listName, array] = this._indexAndListForTemplate(templateUUID)
		if(index !== -1){
			return array[index]
		}
		// It's an unknown template, so fetch it
		let template = new be.api.Template({ uuid: templateUUID })
		template.loading = true
		template.gltf = null
		this.fetchQueue.push(template)
		template.fetch().then(() =>{
			this.fetchQueue.splice(this.fetchQueue.indexOf(template), 1)
			this.loadQueue.push(template)
			this._checkQueues()
		}).catch((err) => {
			this.fetchQueue.splice(this.fetchQueue.indexOf(template), 1)
			template.loading = false
			this.loadedTemplates.push(template)
			this._checkQueues()
		})
		this._checkQueues()
		return template
	}
	_checkQueues(){
		if(this.loadingTemplate !== null || this.loadQueue.length === 0){
			// Already loading a template or there are no templates to load
			return
		}
		this.loadingTemplate = this.loadQueue[this.loadQueue.length - 1]				
		spaciblo.three.GLTFLoader.load(this.loadingTemplate.gltfURL()).then(gltf => {
			this.loadQueue.splice(this.loadQueue.indexOf(this.loadingTemplate), 1)
			this.loadedTemplates.push(this.loadingTemplate)
			this.loadingTemplate.loading = false
			this.loadingTemplate.gltf = gltf
			let template = this.loadingTemplate
			this.loadingTemplate = null
			template.trigger(spaciblo.three.events.GLTFLoaded, template, gltf)
			this._checkQueues()
		}).catch(err => {
			console.error("Failed to load glTF", err)
			this.loadQueue.splice(this.loadQueue.indexOf(this.loadingTemplate), 1)
			this.loadedTemplates.push(this.loadingTemplate)
			this.loadingTemplate.loading = false
			this.loadingTemplate.gltf = null
			let template = this.loadingTemplate
			this.loadingTemplate = null
			template.trigger(spaciblo.three.events.GLTFLoaded, template, gltf)
			this._checkQueues()
		})
	}
	_indexAndListForTemplate(templateUUID){
		// returns [index,fetch/load/loaded,array] for a template or [-1, null, null] if it isn't known
		for(let i = 0; i < this.fetchQueue.length; i++){
			if(this.fetchQueue[i].get('uuid') == templateUUID){
				return [i, "fetch", this.fetchQueue]
			}
		}
		for(let i = 0; i < this.loadQueue.length; i++){
			if(this.loadQueue[i].get('uuid') == templateUUID){
				return [i, "load", this.loadQueue]
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
	THREE.Group.call(this);
}
spaciblo.three.Group.prototype = Object.assign(Object.create(THREE.Group.prototype), {
	constructor: THREE.Group,
	setGLTF: function(gltf){
		this.add(gltf.scene)
	}
})

spaciblo.three.GLTFLoader = class {
	static load(url){
		return new Promise(function(resolve, reject){
			let loader = new THREE.GLTFLoader()
			loader.load(url, (gltf) => {
				/*
				if (gltf.animations && gltf.animations.length) {
					for (let i = 0; i < gltf.animations.length; i++) {
						gltf.animations[i].loop = true;
						gltf.animations[i].play();
					}
				}
				*/
				resolve(gltf)
			})
		})
	}
	static loadTemplate(uuid, name){
		let url = `/api/0.1.0/template/${uuid}/data/${name}.gltf`
		return spaciblo.three.GLTFLoader.load(url)
	}

	static _jankyHack(uuid, name, position=[0,0,-20]){
		spaciblo.three.GLTFLoader.loadTemplate(uuid, name).then(gltf => {
			let node = gltf.scene.children[0]
			window.pageComponent.spacesComponent.renderer.spaceMenu.add(node)
			node.position.x = position[0]
			node.position.y = position[1]
			node.position.z = position[2]
		}).catch((err) => {
			console.error("Error loading", err)
		})
	}
}