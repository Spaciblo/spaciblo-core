var spaciblo = spaciblo || {}
spaciblo.components = spaciblo.components || {}

/*
SplashPageComponent wraps all of the logic for index.html
It's main job is to create a canvas and render spaces into it.
*/
spaciblo.components.SplashPageComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('splash-page-component')

		this.spacesComponent = new spaciblo.components.SpacesComponent()
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

		this.renderer = new spaciblo.components.ThreeJSSpacesRenderer()
		this.el.appendChild(this.renderer.el)
		this.updateSize()
		window.addEventListener('resize', () => { this.updateSize() })
	}
	updateSize(){
		this.renderer.setSize(this.el.offsetWidth, this.el.offsetHeight)
	}
}

/*
ThreeJSSpacesRenderer holds a Three.js scene and is used by SpacesComponent to render spaces
*/
spaciblo.components.ThreeJSSpacesRenderer = class {
	constructor(background=new THREE.Color(0x99DDff)){
		this.scene = new THREE.Scene()
		this.scene.background = background
		this.camera = new THREE.PerspectiveCamera(75, 1, 1, 10000)
		this.renderer = new THREE.WebGLRenderer()
		this.renderer.domElement.setAttribute('class', 'three-js-spaces-renderer spaces-renderer')

		this._boundAnimate = this._animate.bind(this)
		this._animate()
	}
	setSize(width, height){
		this.camera.aspect = width / height
		this.camera.updateProjectionMatrix()
		this.renderer.setSize(width, height)
	}
	_animate() {
		requestAnimationFrame(this._boundAnimate)
		this.renderer.render(this.scene, this.camera)
	}
	_addGeometry(geometry, material){
		var mesh = new THREE.Mesh( geometry, material )
		this.scene.add(mesh)
		return mesh
	}
	get el(){
		return this.renderer.domElement
	}
}
