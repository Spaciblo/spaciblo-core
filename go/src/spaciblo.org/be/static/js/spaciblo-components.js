var spaciblo = spaciblo || {}
spaciblo.events = spaciblo.events || {}
spaciblo.components = spaciblo.components || {}

spaciblo.events.SpaceSelected = 'spaciblo-space-selected'

/*
SplashPageComponent wraps all of the logic for index.html
It's main job is to create a canvas and render spaces into it.
*/
spaciblo.components.SplashPageComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('splash-page-component')

		this.spacesComponent = new spaciblo.components.SpacesComponent(dataObject)
		this.el.appendChild(this.spacesComponent.el)
	}
	handleAddedToDOM(){
		this.spacesComponent.updateSize()
	}
}

/*
SpacesComponent manages a Three.js renderer that displays spaces
*/
spaciblo.components.SpacesComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('spaces-component')
		this.client = null // Will be a spaciblo.api.Client when a Space is selected

		this.renderer = new spaciblo.components.ThreeJSSpacesRenderer()
		this.el.appendChild(this.renderer.el)

		this.dataObject.addListener(this.handleReset.bind(this), "reset")
		if(this.dataObject.length > 0){
			this.handleReset()
		}

		this.updateSize()
		window.addEventListener('resize', () => { this.updateSize() })
		this.renderer.addListener(this.handleSpaceSelected.bind(this), spaciblo.events.SpaceSelected)
	}
	handleSpaceSelected(eventName, space){
		if(this.client != null){
			console.error("Oops, can't open a second space, yet")
			return
		}
		this.client = new spaciblo.api.Client() 
		this.client.addListener(this.handleClientMessages.bind(this), spaciblo.events.ClientMessageReceived)
		this.client.open().then(() => {
			this.client.joinSpace(space)
		}).catch(err => {
			console.error("Error connecting to the WS service", err)
		})
	}
	handleClientMessages(eventName, message){
		console.log("Client message", message)
	}
	handleReset(){
		this.renderer.clearSpacesMenu()
		for(let space of this.dataObject){
			this.renderer.addSpaceToMenu(space, false)
		}
		this.renderer.layoutSpaceMenu()
	}
	updateSize(){
		this.renderer.setSize(this.el.offsetWidth, this.el.offsetHeight)
	}
}

/*
ThreeJSSpacesRenderer holds a Three.js scene and is used by SpacesComponent to render spaces
*/
spaciblo.components.ThreeJSSpacesRenderer = k.eventMixin(class {
	constructor(background=new THREE.Color(0x99DDff)){
		this.clock = new THREE.Clock()
		this.scene = new THREE.Scene()
		this.scene.background = background
		this.camera = new THREE.PerspectiveCamera(75, 1, 1, 10000)

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
		this.spaceMenu.position.z = -5
		this.scene.add(this.spaceMenu)

		this.el.addEventListener('mousemove', this.onDocumentMouseMove.bind(this), false)
		this.el.addEventListener('click', this.onClick.bind(this), false)
		this._boundAnimate = this._animate.bind(this) // Since we use this in every frame, bind it once
		this._animate()
	}
	onClick(ev){
		ev.preventDefault()
		if(this.intersectedObj == null) return
		if(typeof this.intersectedObj.space !== "undefined"){
			this.trigger(spaciblo.events.SpaceSelected, this.intersectedObj.space)
		}
	}
	onDocumentMouseMove(ev){
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
		let currentX = (this.spaceMenuMeshes.length / 2) * distanceBetweenSpaceMenuItems * -1
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

		THREE.GLTFLoader.Animations.update();
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

spaciblo.components.GLTFLoader = class {
	static load(url){
		return new Promise(function(resolve, reject){
			let loader = new THREE.GLTFLoader()
			loader.load(url, (gltf) => {
				if (gltf.animations && gltf.animations.length) {
					for (let i = 0; i < gltf.animations.length; i++) {
						gltf.animations[i].loop = true;
						gltf.animations[i].play();
					}
				}
				resolve(gltf)
			})
		})
	}
}