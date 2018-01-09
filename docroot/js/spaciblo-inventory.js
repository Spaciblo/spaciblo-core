"use strict";

var spaciblo = spaciblo || {}
spaciblo.events = spaciblo.events || {}
spaciblo.components = spaciblo.components || {}

spaciblo.components.IMAGE_VIEWER_TEMPLATE_NAME = 'Image Viewer'

spaciblo.events.SettingUpdated = 'spaciblo-setting-updated'
spaciblo.events.NodeUpdated = 'spaciblo-node-updated'
spaciblo.events.TemplatePicked = 'spaciblo-template-picked'
spaciblo.events.NodeRemoved = 'spaciblo-node-removed'
spaciblo.events.TemplateDataItemSelected = 'spaciblo-template-data-item-selected';

/* 
The number of miliseconds after input to ignore model updates so that
we don't override local edits with updates
*/
spaciblo.components.InputChangeDelay = 2000

/*
InventoryPageComponent wraps all of the logic for i/index.html
*/
spaciblo.components.InventoryPageComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('inventory-page-component')
		this.topNav = new be.ui.TopNavComponent()
		this.el.appendChild(this.topNav.el)

		this.router = new k.Router()
		this.router.addRoute(/^$/, 'templates')
		this.router.addRoute(/^templates\/([0-9\-a-z]+)$/, 'template')
		this.router.addRoute(/^spaces$/, 'spaces')
		this.router.addRoute(/^spaces\/([0-9\-a-z]+)$/, 'space')
		this.router.addRoute(/^avatars$/, 'avatars')
		this.router.addRoute(/^avatars\/([0-9\-a-z]+)$/, 'avatar')

		this.topRow = k.el.div({ class: 'top-row' }).appendTo(this.el)
		this.buttonGroup = k.el.div({ class: 'button-group' }).appendTo(this.topRow)
		this.templatesButton = k.el.button('Templates').appendTo(this.buttonGroup)
		this.listenTo('click', this.templatesButton, () => { document.location.hash = '#' }, this)
		this.spacesButton = k.el.button('Spaces').appendTo(this.buttonGroup)
		this.listenTo('click', this.spacesButton, () => { document.location.hash = '#spaces' }, this)
		this.avatarsButton = k.el.button('Avatars').appendTo(this.buttonGroup)
		this.listenTo('click', this.avatarsButton, () => { document.location.hash = '#avatars' }, this)

		this.templates = new be.api.Templates()
		this.templatesEditorComponent = new spaciblo.components.TemplatesEditorComponent(this.templates)
		this.el.appendChild(this.templatesEditorComponent.el)
		this.templatesEditorComponent.addListener((eventName, dataObject, ladComponent, detailComponent) => {
			window.history.pushState({}, "Template", "#templates/" + dataObject.get('uuid'))
		}, be.events.ItemSelected)

		this.spaces = new be.api.Spaces()
		this.spacesEditorComponent = new spaciblo.components.SpacesEditorComponent(this.spaces)
		this.el.appendChild(this.spacesEditorComponent.el)
		this.spacesEditorComponent.addListener((eventName, dataObject, ladComponent, detailComponent) => {
			window.history.pushState({}, "Space", "#spaces/" + dataObject.get('uuid'))
		}, be.events.ItemSelected)

		this.avatars = new be.api.Avatars()
		this.avatarsEditorComponent = new spaciblo.components.AvatarsEditorComponent(this.avatars)
		this.el.appendChild(this.avatarsEditorComponent.el)
		this.avatarsEditorComponent.addListener((eventName, dataObject, ladComponent, detailComponent) => {
			window.history.pushState({}, "Avatar", "#avatars/" + dataObject.get('uuid'))
		}, be.events.ItemSelected)

		this.router.addListener(this._handleRoutes.bind(this))
		this.router.start()
	}
	_clearDisplay(){
		for(let button of this.buttonGroup.querySelectorAll('button')){
			button.removeClass('selected')
		}
		for(let editor of this.el.querySelectorAll('.editor-component')){
			editor.style.display = 'none'
		}
	}
	_handleRoutes(eventName, path, ...params){
		switch(eventName){
			case 'templates':
				this._showTemplates()
				break;
			case 'template':
				this._showTemplates(params[0])
				break
			case 'spaces':
				this._showSpaces()
				break
			case 'space':
				this._showSpaces(params[0])
				break
			case 'avatars':
				this._showAvatars()
				break
			case 'avatar':
				this._showAvatars(params[0])
				break
			default:
				console.error('Unknown route', eventName, ...params)
				this._showTemplates()
		}
	}
	_showTemplates(uuid=null){
		this._clearDisplay()
		this.templatesEditorComponent.el.style.display = 'block'
		this.templatesButton.addClass('selected')
		if(this.templates.isNew){
			this.templates.fetch().then(() => {
				if(uuid !== null){
					let template = this.templates.firstByField('uuid', uuid)
					if(template){
						this.templatesEditorComponent.setSelected(template)
					}
				}
			})
		} else {
			if(uuid !== null){
				let template = this.templates.firstByField('uuid', uuid)
				if(template){
					this.templatesEditorComponent.setSelected(template)
				}
			}
		}
	}
	_showSpaces(uuid=null){
		this._clearDisplay()
		this.spacesEditorComponent.el.style.display = 'block'
		this.spacesButton.addClass('selected')
		if(this.spaces.isNew){
			this.spaces.fetch().then(() => {
				if(uuid !== null){
					let space = this.spaces.firstByField('uuid', uuid)
					if(space){
						this.spacesEditorComponent.setSelected(space)
					}
				}
			})
		} else {
			if(uuid !== null){
				let space = this.spaces.firstByField('uuid', uuid)
				if(space){
					this.spacesEditorComponent.setSelected(space)
				}
			}
		}
	}
	_showAvatars(uuid=null){
		this._clearDisplay()
		this.avatarsEditorComponent.el.style.display = 'block'
		this.avatarsButton.addClass('selected')
		if(this.avatars.isNew){
			this.avatars.fetch().then(() => {
				if(uuid !== null){
					let avatar = this.avatars.firstByField('uuid', uuid)
					if(avatar){
						this.avatarsEditorComponent.setSelected(avatar)
					}
				}
			})
		} else {
			if(uuid !== null){
				let avatar = this.avatars.firstByField('uuid', uuid)
				if(avatar){
					this.avatarsEditorComponent.setSelected(avatar)
				}
			}
		}
	}
}

/*
SpacesEditorComponent shows a list of spaces and editable details for a space when it is selected
*/
spaciblo.components.SpacesEditorComponent = class extends be.ui.ListAndDetailComponent {
	constructor(dataObject=null, options={}){
		super(dataObject, Object.assign({
			itemType: be.api.Space,
			itemComponent: spaciblo.components.SpaceItemComponent,
			detailComponent: spaciblo.components.SpaceDetailComponent
		}, options))
		this.el.addClass('spaces-editor-component')
		this.el.addClass('editor-component')
	}
}

/*
SpaceItemComponent renders the name of a space for use in the list in SpacesEditorComponent
*/
spaciblo.components.SpaceItemComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, Object.assign({ el: k.el.li() }, options))
		this.el.addClass('space-item-component')
		this.el.addClass('item-component')
		if(dataObject === null) throw 'SpaceItemComponent requires a Space dataObject'

		this.nameEl = k.el.div().appendTo(this.el)
		this.bindText('name', this.nameEl, (value) => {
			if(!value) return 'Unnamed'
			return value
		})
	}
}

/*
SpaceDetailComponent allows editing of a live space from within the SpaceEditorComponent
It displays a scene graph on the left, and when a node in the graph is selected it displays its properties on the right
*/
spaciblo.components.SpaceDetailComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('space-detail-component')
		this.el.addClass('detail-component')
		if(dataObject === null) throw 'SpaceDetailComponent requires a Space dataObject'
		this.propertiesComponent = null // Will hold a SceneGraphNodePropertiesComponent when a node is selected

		this.headlineRow = k.el.div({ class: 'headline-row row' }).appendTo(this.el)
		this.headlineCol = k.el.div({ class: 'col-12' }).appendTo(this.headlineRow)
		this.nameInput = new be.ui.TextInputComponent(dataObject, 'name', { autosave: true })
		this.headlineCol.appendChild(this.nameInput.el)

		this.row = k.el.div({ class: 'row' }).appendTo(this.el)
		this.leftCol = k.el.div({ class: 'left-col col-2' }).appendTo(this.row)
		this.rightCol = k.el.div({ class: 'right-col col-10' }).appendTo(this.row)

		this.sceneGraphTree = new spaciblo.components.SceneGraphTree(this.dataObject)
		this.sceneGraphTree.addListener((...params) => { this._handleNodeSelected(...params) }, 'node-selected')
		this.leftCol.appendChild(this.sceneGraphTree.el)
		this.sceneGraphTree.openClient()

	}
	_clearSelection(){
		if(this.propertiesComponent === null) return
		this.rightCol.removeChild(this.propertiesComponent.el)
		this.propertiesComponent.cleanup()
		this.propertiesComponent = null
	}
	_handleNodeSelected(eventName, sceneGraphNode, selected){
		if(selected === false){
			this._clearSelection()
			return
		}
		if(this.propertiesComponent !== null && this.propertiesComponent.sceneGraphNode === sceneGraphNode){
			// nothing to do, properties already shown
			return
		}
		this._clearSelection()
		this.propertiesComponent = new spaciblo.components.SceneGraphNodePropertiesComponent(sceneGraphNode.dataObject, {
			client: this.sceneGraphTree.client
		})
		if(sceneGraphNode.parent === null){
			this.propertiesComponent.el.addClass('root-node')
		}
		this.rightCol.appendChild(this.propertiesComponent.el)
	}
	cleanup(){
		super.cleanup()
		this.sceneGraphTree.cleanup()
		if(this.propertiesComponent) this.propertiesComponent.cleanup()
	}
}

/*
SceneGraphTree shows the hierarchy SceneGraphNodes in a space
*/
spaciblo.components.SceneGraphTree = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		if(dataObject === null) throw 'SceneGraphTree requires a Space dataObject'
		this._boundHandleClientMessages = this._handleClientMessages.bind(this)
		this._imageViewerTemplate = null
		this.objectMap = new Map() // node id -> spaciblo.components.SceneGraphNode
		this.client = new spaciblo.api.Client()
		this.receivedFirstUpdate = false
		this.clientUUID = null
		this.rootNode = null
		this.selectedNode = null
		this._addedToParent = null
		this.client.addListener(this._boundHandleClientMessages, spaciblo.events.ClientMessageReceived)

		// Find the Image Viewer template
		new be.api.Templates().fetch().then((templates) => {
			for(let template of templates){
				if(template.get('name') !== spaciblo.components.IMAGE_VIEWER_TEMPLATE_NAME){
					continue
				}
				this._imageViewerTemplate = template
				break
			}
			if(this._imageViewerTemplate === null){
				console.error('Could not find template named', spaciblo.components.IMAGE_VIEWER_TEMPLATE_NAME)
			}
		}).catch((...params) => {
			console.error('error fetching image viewer template', ...params)
		})
	}
	openClient(){
		this.client.open().then(() => {
			this.client.joinSpace(this.dataObject, false)
		}).catch(err => {
			console.error("Error connecting to the WS service", err)
		})
	}
	cleanup(){
		super.cleanup()
		this.client.cleanup()
		if(this.rootNode){
			this.rootNode.cleanup()
		}
	}
	_handleClientMessages(eventName, message){
		switch(message.type){
			case 'Ack':
				break
			case 'Connected':
				this.clientUUID = message.clientUUID
				break
			case 'Space-Update':
				/*
				if(
					(message.additions && message.additions.length > 0) || 
					(message.deletions && message.deletions.length > 0) || 
					(message.nodeUpdates && message.nodeUpdates.length > 0)
				){
					console.log("Space update", message)
				}
				*/
				let additions = message.additions || []
				for(let addition of additions){
					this._handleAddition(addition)
				}
				let deletions = message.deletions || []
				for(let deletion of deletions){
					this._handleDeletion(deletion)
				}
				let nodeUpdates = message.nodeUpdates || []
				for(let nodeUpdate of nodeUpdates){
					this._handleNodeUpdate(nodeUpdate)
				}
				if(this.receivedFirstUpdate === false){
					if(this.rootNode !== null){
						this.receivedFirstUpdate = true
						this._handleNodeClick('click', this.rootNode)
					}
				}
				break
			default:
				console.error("Unhandled client message", message)
		}
	}
	_handleNodeUpdate(update){
		let node = this.objectMap.get(update.id)
		if(typeof node === 'undefined'){
			console.error('Tried to update unknown object', update)
			return
		}
		node.dataObject.handleUpdate(update)
	}
	_handleAddition(addition){
		if(this.objectMap.has(addition.id)){
			return
		}
		if(addition.parent === -1){
			var parent = null
		} else {
			var parent = this.objectMap.get(addition.parent)
			if(typeof parent === 'undefined') {
				console.error('Tried to add to an unknown parent', this.objectMap, addition)
				return
			}
		}
		try {
			let node = new spaciblo.components.SceneGraphNode(addition)
			this.objectMap.set(addition.id, node)
			if(addition.parent === -1){
				this.rootNode = node
				this.rootNode.addListener((...params) => {
					this._handleNodeClick(...params)
				}, 'node-click')
				this.rootNode.addListener((...params) => {
					this._handleAddNodeClick(...params)
				}, 'add-node-click')
				this.rootNode.addListener((...params) => {
					this._handleAddFilesRequest(...params)
				}, 'add-files-request')
				this.el.appendChild(node.el)
			} else {
				parent.addChild(node)
				if(this._addedToParent === parent.dataObject.get('id')){
					this._addedToParent = null
					this._handleNodeClick('node-click', node)
				}
			}
		} catch (e){
			console.error(e)			
		}
	}
	_handleDeletion(deletion){
		let node = this.objectMap.get(deletion)
		if(typeof node === 'undefined'){
			return
		}
		this.objectMap.delete(deletion)
		if(node.parent){
			node.parent.removeChild(node)
		} else {
			this.el.removeChild(this.rootNode.el)
			this.rootNode = null
		}
		for(let childId of node.getChildrenIds()){
			this.objectMap.delete(childId)
		}

		if(this.selectedNode === node){
			this.selectedNode = null
			this.trigger('node-selected', null, false)
		}

		node.cleanup()
	}
	_handleAddNodeClick(eventName, node){
		this._addedToParent = node.dataObject.get('id')
		this.client.sendAddNode(node.dataObject.get('id'))
	}
	_handleNodeClick(eventName, node){
		if(this.selectedNode === node){
			return
		}
		if(this.selectedNode !== null){
			this.selectedNode.el.removeClass('selected')
		}
		this.selectedNode = node
		this.selectedNode.el.addClass('selected')
		this.trigger('node-selected', node, true)
	}
	_handleAddFilesRequest(eventName, node, files){
		if(this._imageViewerTemplate === null){
			console.error('Image viewer template could not be found')
			return
		}

		// Find all of the images in `files`
		let images = []
		for(let file of files){
			if(file.type !== 'image/png' && file.type !== 'image/jpg'){
				console.error('ignoring file', file)
				continue
			}
			images.push(file)
		}

		// createNodes will be called when all of the images have been uploaded as resources to the image viewer template
		let addedImages = []
		let createNodes = () => {
			// For each added image, create an instance of the Image Viewer template and set it up to show the image
			for(let imageFile of addedImages){
				let image = new Image()
				image.onload = () => {
					if(image.width === 0 || image.height === 0){
						console.error('invalid image', imageFile.name)
						return
					}
					let scale = [1, image.height / image.width, 1]
					this.client.sendAddNode(node.dataObject.get('id'), {
						name: imageFile.name,
						templateUUID: this._imageViewerTemplate.get('uuid'),
						fileName: imageFile.name
					}, [0,0,0], [0,0,0,1], [0,0,0], [0,0,0], scale)
				}
				image.src = URL.createObjectURL(imageFile)
			}
		}

		// Upload all images as resources to the image viewer template
		let fileCount = images.length
		for(let file of images){
			be.api.TemplateData.postFile(this._imageViewerTemplate.get('uuid'), file).then((...params) => {
				addedImages.push(file)
				fileCount -= 1
				if(fileCount == 0){
					createNodes()
				}
			}).catch((...params) => {
				console.error('Error', ...params)
				fileCount -= 1
				if(fileCount == 0){
					createNodes()
				}
			})
		}
	}
}

/*
SceneGraphNodeData wraps the data for a simulator node so that it becomes reactive with events.
*/
spaciblo.components.SceneGraphNodeData = class extends k.DataModel {
	constructor(addition){
		super(Object.assign({ id: addition.id }, addition.settings))
		this._updatePositioning(addition)
		this.set('templateUUID', addition.templateUUID)
	}
	handleUpdate(update){
		this._updateSettings(update)
		this._updatePositioning(update)
		if(typeof update.templateUUID !== 'undefined' && update.templateUUID !== ''){
			this.set('templateUUID', update.templateUUID)
		}
	}
	_updateSettings(data){
		if(data.settings){
			for(let key in data.settings){
				if(data.settings[key] == spaciblo.api.RemoveKeyIndicator){
					this.set(key, null)
				} else {
					this.set(key, data.settings[key])
				}
			}
		}
	}
	_updatePositioning(data){
		if(data.position) this.set('position', data.position)
		if(data.orientation) this.set('orientation', data.orientation)
		if(data.rotation) this.set('rotation', data.rotation)
		if(data.translation) this.set('translation', data.translation)
		if(data.scale) this.set('scale', data.scale)
	}
}

/*
SceneGraphNode shows information about a node in the scene graph of a space and its children
*/
spaciblo.components.SceneGraphNode = class extends k.Component {
	constructor(addition){
		super(new spaciblo.components.SceneGraphNodeData(addition))
		this.el.addClass('scene-graph-node')
		this.parent = null
		this.lastUpdate = null
		this.id = addition.id
		this._boundHandleModelChange = this._handleModelChange.bind(this)

		this.addButton = k.el.button(
			{ class: 'small-button' },
			'+'
		)
		this.listenTo('click', this.addButton, this._handleAddClick, this)

		this.displayNameEl = k.el.span(this._displayName)
		this.listenTo('click', this.displayNameEl, this._handleClick, this)

		this.headlineEl = k.el.div(
			{ class: 'headline' }, 
			this.displayNameEl, 
			this.addButton
		).appendTo(this.el)

		this.ul = k.el.ul({ class: 'children' }).appendTo(this.el)

		this.dataObject.addListener(this._boundHandleModelChange, 'changed:name')
		this.dataObject.addListener(this._boundHandleModelChange, 'changed:clientUUID')

		this.el.addEventListener('dragover', ev => { this._handleDragOver(ev) }, false)
		this.el.addEventListener('dragexit', ev => { this._handleDragExit(ev) }, false)
		this.el.addEventListener('drop', ev => { this._handleDrop(ev) }, false)
	}
	_handleNewFiles(files){
		this.trigger('add-files-request', this, files)
	}
	_handleDragOver(ev){
		ev.stopPropagation()
		ev.preventDefault()
		ev.dataTransfer.dropEffect = 'copy';
		this.el.addClass('file-hover')
	}
	_handleDragExit(ev){
		ev.stopPropagation();
		ev.preventDefault();
		this.el.removeClass('file-hover')
	}
	_handleDrop(ev){
		ev.stopPropagation();
		ev.preventDefault();
		this.el.removeClass('file-hover')
		if(ev.dataTransfer.files.length == 0) return
		this._handleNewFiles(ev.dataTransfer.files)
	}
	cleanup(){
		super.cleanup()
		this.dataObject.cleanup()
		for(let child of this.ul.children){
			if(child.component instanceof spaciblo.components.SceneGraphNode){
				child.component.cleanup()
			}
		}
	}
	get _displayName(){
		return this.dataObject.get('name', 'Unnamed')
	}
	_handleAddClick(ev){
		if(ev) ev.preventDefault()
		this.trigger('add-node-click', this)
	}
	_handleModelChange(){
		this.displayNameEl.innerText = this._displayName
	}
	_handleClick(ev){
		this.trigger('node-click', this)
	}
	addChild(childNode){
		this.ul.appendChild(childNode.el)
		childNode.addListener((...params) => {
			this.trigger(...params) // Relay up the chain
		}, 'node-click')
		childNode.addListener((...params) => {
			this.trigger(...params) // Relay up the chain
		}, 'add-node-click')
		childNode.addListener((...params) => {
			this.trigger(...params) // Relay up the chain
		}, 'add-files-request')
		childNode.parent = this
	}
	removeChild(childNode){
		this.ul.removeChild(childNode.el)
		childNode.parent = null
	}
	getChildrenIds(results=[]){
		if(this.ul.children.length === 0){
			return results
		}
		for(let child of this.ul.children){
			if(child.component instanceof spaciblo.components.SceneGraphNode){
				results.push(child.component.id)
			}
			if(typeof child.getChildrenIds !== 'undefined'){
				child.getChildrenIds(results)
			}
		}
		return results
	}
}

/*
SceneGraphNodePropertiesComponent shows a column of Components representing the metadata for a SceneGraphNode
For example, a translation/orientation Component, a light Component, settings, etc. 
*/
spaciblo.components.SceneGraphNodePropertiesComponent = class extends k.Component {
	constructor(dataObject, options){
		if(typeof options.client === 'undefined') throw 'SceneGraphNodePropertiesComponent requires a client option'
		super(dataObject, options)
		this.el.addClass('scene-graph-node-properties-component')

		this.settingsComponent = new spaciblo.components.SceneGraphNodeSettingsComponent(this.dataObject)
		this.settingsComponent.addListener((...params) => { this._handleSettingUpdated(...params) }, spaciblo.events.SettingUpdated)
		this.settingsComponent.addListener((...params) => { this._handleRemoveNode(...params) }, spaciblo.events.NodeRemoved)
		this.el.appendChild(this.settingsComponent.el)

		this.templateComponent = new spaciblo.components.TemplateEditorComponent(this.dataObject)
		this.templateComponent.addListener((...params) => { this._handleNodeUpdated(...params) }, spaciblo.events.NodeUpdated)
		this.el.appendChild(this.templateComponent.el)

		this.lightingComponent = new spaciblo.components.SceneGraphNodeLightingComponent(this.dataObject)
		this.lightingComponent.addListener((...params) => { this._handleSettingUpdated(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.lightingComponent.el)

		this.positioningComponent = new spaciblo.components.SceneGraphNodePositioningComponent(this.dataObject)
		this.positioningComponent.addListener((...params) => { this._handleNodeUpdated(...params) }, spaciblo.events.NodeUpdated)
		this.el.appendChild(this.positioningComponent.el)
	}
	cleanup(){
		super.cleanup()
		this.settingsComponent.cleanup()
		this.lightingComponent.cleanup()
		this.positioningComponent.cleanup()
	}
	_handleNodeUpdated(eventName, objectId, name, value){
		this.options.client.sendUpdateRequest(objectId, name, value)
	}
	_handleRemoveNode(eventName, objectId){
		this.options.client.sendRemoveNode(objectId)
	}
	_handleSettingUpdated(eventName, objectId, name, value){
		this.options.client.sendSettingRequest(objectId, name, value)
	}
}

/*
SceneGraphNodeSettingsComponent shows all of the settings that aren't displayed in other components
*/
spaciblo.components.SceneGraphNodeSettingsComponent = class extends k.Component {
	constructor(dataObject){
		super(dataObject)
		this.el.addClass('scene-graph-node-settings-component')
		this.el.addClass('scene-graph-node-property-component')
		this.settingsMap = new Map() // name -> SceneNodeSettingComponent

		this.removeButton = k.el.button({ class: 'delete-node-button small-button' }, 'delete').appendTo(this.el)
		this.listenTo('click', this.removeButton, () => {
			this.trigger(spaciblo.events.NodeRemoved, this.dataObject.get('id'))
		})

		this.el.appendChild(k.el.h3('Settings'))

		this.visibleComponent = new spaciblo.components.SceneGraphNodeBooleanSettingComponent(this.dataObject, {
			fieldName: 'visible',
			defaultValue: true
		})
		this.visibleComponent.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.visibleComponent.el)

		for(let key in this.dataObject.data){
			if(spaciblo.api.IgnoredSettings.indexOf(key) != -1) continue
			if(spaciblo.api.PositioningSettingsNames.indexOf(key) != -1) continue
			if(spaciblo.api.LightingSettingsNames.indexOf(key) != -1) continue
			let settingComponent = new spaciblo.components.SceneNodeStringSettingComponent(this.dataObject, { fieldName: key })
			settingComponent.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
			this.settingsMap.set(key, settingComponent)
			this.el.appendChild(settingComponent.el)
		}
	}
	cleanup(){
		super.cleanup()
		this.visibleComponent.cleanup()
		for(let [key, value] of this.settingsMap){
			this.settingsMap.get(key).cleanup()
		}
	}
}

/*
TemplateEditorComponent provides an editor of a DataObject template
*/
spaciblo.components.TemplateEditorComponent = class extends k.Component {
	constructor(dataObject){
		super(dataObject)
		this.el.addClass('template-editor-component')
		this.el.addClass('scene-graph-node-property-component')

		this.template = new be.api.Template({ uuid: this.dataObject.get('templateUUID') })
		this.el.appendChild(k.el.h3('Template'))

		this.nameEl = k.el.h4().appendTo(this.el)
		this.removeLink = k.el.button({ class: 'small-button' }, 'x')
		this.listenTo('click', this.removeLink, this._handleRemoveClick, this)

		this.changeLink = k.el.a('change').appendTo(this.el)
		this.listenTo('click', this.changeLink, this._handleChangeClick, this)

		this.templatePickerComponent = new spaciblo.components.TemplatePickerComponent()
		this.templatePickerComponent.addListener((...params) => { this._handleTemplatePicked(...params) }, spaciblo.events.TemplatePicked)
		this.el.appendChild(this.templatePickerComponent.el)
		this.templatePickerComponent.el.style.display = 'none'

		this.cancelLink = k.el.a('cancel').appendTo(this.el)
		this.cancelLink.style.display = 'none'
		this.listenTo('click', this.cancelLink, this._handleCancelClick, this)

		if(this.template.get('uuid')){
			this.template.fetch().then(() => {
				this._updateTemplate()
			}).catch((...params) => {
				console.error('error', ...params)
			})
		}

		this.dataObject.addListener(() => {
			if(this.dataObject.has('templateUUID') && this.dataObject.get('templateUUID') !== spaciblo.api.RemoveKeyIndicator){
				this.template.reset({ 'uuid': this.dataObject.get('templateUUID') })
				this.template.fetch().then(() => {
					this._updateTemplate()
				}).catch((...params) => {
					console.error('error', ...params)
				})
			} else {
				this.template.reset({})
				this._updateTemplate()
			}
		}, 'changed:templateUUID')
	}
	cleanup(){
		super.cleanup()
		this.templatePickerComponent.cleanup()
	}
	_showPicker(){
		this.changeLink.style.display = 'none'
		this.templatePickerComponent.el.style.display = 'block'
		this.cancelLink.style.display = 'block'
	}
	_hidePicker(){
		this.changeLink.style.display = 'block'
		this.templatePickerComponent.el.style.display = 'none'
		this.cancelLink.style.display = 'none'
	}
	_handleTemplatePicked(eventName, pickerComponent, templateDataObject){
		this._hidePicker()
		if(templateDataObject.get('uuid') === this.dataObject.get('templateUUID')) return
		this.trigger(spaciblo.events.NodeUpdated, this.dataObject.get('id'), 'templateUUID', templateDataObject.get('uuid'))
	}
	_handleRemoveClick(ev){
		this.trigger(spaciblo.events.NodeUpdated, this.dataObject.get('id'), 'templateUUID', spaciblo.api.RemoveKeyIndicator)
	}
	_handleCancelClick(ev){
		this._hidePicker()
	}
	_handleChangeClick(ev){
		this._showPicker()
		if(this.templatePickerComponent.dataObject.isNew){
			this.templatePickerComponent.dataObject.fetch()
		}
	}
	_updateTemplate(){
		this.nameEl.innerText = ''			
		if(this.template.get('name')){
			this.nameEl.appendChild(k.el.span(this.template.get('name')))
			this.nameEl.appendChild(this.removeLink)
		}
	}
}

/*
TemplatePickerComponent is used in the editor when picking a new Template for a scene graph node
*/
spaciblo.components.TemplatePickerComponent = class extends k.Component {
	constructor(){
		super(new be.api.Templates())
		this.el.addClass('template-picker-component')
		this.templatesComponent = new be.ui.CollectionComponent(this.dataObject, {
			itemComponent: spaciblo.components.TemplatePickerItemComponent,
			onClick: (dataObject) => { this._handleItemClick(dataObject) }
		})
		this.el.appendChild(this.templatesComponent.el)
	}
	_handleItemClick(dataObject){
		this.trigger(spaciblo.events.TemplatePicked, this, dataObject)
	}
	cleanup(){
		super.cleanup()
		this.dataObject.cleanup()
	}
}
spaciblo.components.TemplatePickerItemComponent = class extends k.Component {
	constructor(dataObject, options){
		super(dataObject, options)
		this.el.addClass('template-picker-item-component')
		this.nameEl = k.el.div().appendTo(this.el)
		this.bindText('name', this.nameEl)
	}
}

/*
SceneGraphNodeLightingComponent provides an editor of a node's lighting settings
*/
spaciblo.components.SceneGraphNodeLightingComponent = class extends k.Component {
	constructor(dataObject){
		super(dataObject)
		this.el.addClass('scene-graph-node-lighting-component')
		this.el.addClass('scene-graph-node-property-component')
		this._boundHandleModelChange = this._handleModelChange.bind(this)

		this.el.appendChild(k.el.h3('Light'))

		this.typeRadioGroup = k.el.div({ class: 'type-group' }).appendTo(this.el)
		this.typeRadioGroup.appendChild(k.el.label({ for: 'lightingType_none' }, 'None'))
		let noneInput = k.el.input({
			type: 'radio',
			name: 'lightingType',
			id: 'lightingType_none',
			value: ''
		}, 'none')
		this.typeRadioGroup.appendChild(noneInput)
		this.listenTo('change', noneInput, this._handleRadioClick, this)

		for(let lightingType of spaciblo.api.LightingTypes){
			let typeId = 'lightingType_' + lightingType
			this.typeRadioGroup.appendChild(k.el.label({ for: typeId }, be.ui.initialUpperCase(lightingType)))
			let input = k.el.input({
				type: 'radio',
				name: 'lightingType',
				id: typeId,
				value: lightingType
			})
			this.typeRadioGroup.appendChild(input)
			this.listenTo('change', input, this._handleRadioClick, this)
		}

		this.commonSettings = new spaciblo.components.CommonLightSettingsComponent(this.dataObject)
		this.commonSettings.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.commonSettings.el)

		this.directionalSettings = new spaciblo.components.DirectionalLightSettingsComponent(this.dataObject);
		this.directionalSettings.addListener((...params) => { this.trigger(...params) }, spaciblo.events.NodeUpdated)
		this.directionalSettings.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.directionalSettings.el)

		this.pointSettings = new spaciblo.components.PointLightSettingsComponent(this.dataObject);
		this.pointSettings.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.pointSettings.el)

		this.spotSettings = new spaciblo.components.SpotLightSettingsComponent(this.dataObject);
		this.spotSettings.addListener((...params) => { this.trigger(...params) }, spaciblo.events.NodeUpdated)
		this.spotSettings.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.spotSettings.el)

		this.hemisphereSettings = new spaciblo.components.HemisphereLightSettingsComponent(this.dataObject);
		this.hemisphereSettings.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.hemisphereSettings.el)

		this.dataObject.addListener(this._boundHandleModelChange, 'changed:light-type')
		this._updateFromModel()
	}
	cleanup(){
		super.cleanup()
		this.dataObject.removeListener(this._boundHandleModelChange)
		this.commonSettings.cleanup()
		this.directionalSettings.cleanup()
		this.pointSettings.cleanup()
		this.spotSettings.cleanup()
		this.hemisphereSettings.cleanup()
	}
	_showLightSettings(){
		this.commonSettings.el.style.display = 'none'
		this.directionalSettings.el.style.display = 'none'
		this.pointSettings.el.style.display = 'none'
		this.spotSettings.el.style.display = 'none'
		this.hemisphereSettings.el.style.display = 'none'

		switch(this.dataObject.get('light-type')) {
			case 'ambient':
				this.commonSettings.el.style.display = 'block'
				break
			case 'directional':
				this.commonSettings.el.style.display = 'block'
				this.directionalSettings.el.style.display = 'block'
				break
			case 'point':
				this.commonSettings.el.style.display = 'block'
				this.pointSettings.el.style.display = 'block'
				break;
			case 'spot':
				this.commonSettings.el.style.display = 'block'
				this.spotSettings.el.style.display = 'block'
				break;
			case 'hemisphere':
				this.commonSettings.el.style.display = 'block'
				this.hemisphereSettings.el.style.display = 'block'
				break
		}
	}
	get _radioValue(){
		for(let child of this.typeRadioGroup.querySelectorAll('input')){
			if(child.checked === true){
				return child.getAttribute('value') || ''
			}
		}
		return ''
	}
	_handleRadioClick(ev){
		let radioValue = this._radioValue
		if(radioValue == this.dataObject.get('light-type', '')) return
		this.trigger(spaciblo.events.SettingUpdated, this.dataObject.get('id'), 'light-type', radioValue)
	}
	_handleModelChange(...params){
		this._updateFromModel()
	}
	_updateFromModel(){
		let lightType = this.dataObject.get('light-type', '')
		for(let child of this.typeRadioGroup.children){
			if(lightType === child.getAttribute('value')){
				child.setAttribute('checked', true)
			} else {
				child.removeAttribute('checked')
			}
		}
		this._showLightSettings()
	}
}

/*
Settings that are common to all lights
*/
spaciblo.components.CommonLightSettingsComponent = class extends k.Component {
	constructor(dataObject, options={}){
		super(dataObject, options)
		this.el.addClass('common-light-settings')

		this.el.appendChild(k.el.h3('Color'))
		this.colorComponent = new spaciblo.components.SceneNodeStringSettingComponent(this.dataObject, { fieldName: 'light-color' })
		this.colorComponent.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.colorComponent.el)

		this.el.appendChild(k.el.h3('Intensity'))
		this.intensityComponent = new spaciblo.components.SceneNodeStringSettingComponent(this.dataObject, { fieldName: 'light-intensity' })
		this.intensityComponent.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.intensityComponent.el)
	}
	cleanup(){
		super.cleanup()
		this.colorComponent.cleanup()
		this.intensityComponent.cleanup()
	}
}

/*
Settings that only the DirectionalLight uses.
*/
spaciblo.components.DirectionalLightSettingsComponent = class extends k.Component {
	constructor(dataObject, options={}){
		super(dataObject, options)
		this.el.addClass('directional-light-settings')

		this.el.appendChild(k.el.h3('Target'))
		this.targetComponent = new spaciblo.components.VectorEditorComponent(this.dataObject, 'light-target', [0,0,0])
		this.targetComponent.addListener((eventName, objectId, name, value) => { this.trigger(
			spaciblo.events.SettingUpdated, objectId, name, value.join(',')
		) }, spaciblo.events.NodeUpdated)

		this.el.appendChild(this.targetComponent.el)
	}
	cleanup(){
		super.cleanup()
		this.targetComponent.cleanup()
	}
}

/*
Settings that only the PointLight uses.
*/
spaciblo.components.PointLightSettingsComponent = class extends k.Component {
	constructor(dataObject, options={}){
		super(dataObject, options)
		this.el.addClass('point-light-settings')

		this.el.appendChild(k.el.h3('Distance'))
		this.distanceComponent = new spaciblo.components.SceneNodeStringSettingComponent(this.dataObject, { fieldName: 'light-distance' })
		this.distanceComponent.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.distanceComponent.el)

		this.el.appendChild(k.el.h3('Decay'))
		this.decayComponent = new spaciblo.components.SceneNodeStringSettingComponent(this.dataObject, { fieldName: 'light-decay' })
		this.decayComponent.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.decayComponent.el)
	}
	cleanup(){
		super.cleanup()
		this.distanceComponent.cleanup()
		this.decayComponent.cleanup()
	}
}

/*
Settings that only the SpotLight uses.
*/
spaciblo.components.SpotLightSettingsComponent = class extends k.Component {
	constructor(dataObject, options={}){
		super(dataObject, options)
		this.el.addClass('spot-light-settings')

		this.el.appendChild(k.el.h3('Distance'))
		this.distanceComponent = new spaciblo.components.SceneNodeStringSettingComponent(this.dataObject, { fieldName: 'light-distance' })
		this.distanceComponent.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.distanceComponent.el)

		this.el.appendChild(k.el.h3('Decay'))
		this.decayComponent = new spaciblo.components.SceneNodeStringSettingComponent(this.dataObject, { fieldName: 'light-decay' })
		this.decayComponent.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.decayComponent.el)

		this.el.appendChild(k.el.h3('Angle'))
		this.angleComponent = new spaciblo.components.SceneNodeStringSettingComponent(this.dataObject, { fieldName: 'light-angle' })
		this.angleComponent.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.angleComponent.el)

		this.el.appendChild(k.el.h3('Penumbra'))
		this.penumbraComponent = new spaciblo.components.SceneNodeStringSettingComponent(this.dataObject, { fieldName: 'light-penumbra' })
		this.penumbraComponent.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.penumbraComponent.el)

		this.el.appendChild(k.el.h3('Target'))
		this.targetComponent = new spaciblo.components.VectorEditorComponent(this.dataObject, 'light-target', [0,0,0])
		this.targetComponent.addListener((eventName, objectId, name, value) => { this.trigger(
			spaciblo.events.SettingUpdated, objectId, name, value.join(',')
		) }, spaciblo.events.NodeUpdated)
		this.el.appendChild(this.targetComponent.el)
	}
	cleanup(){
		super.cleanup()
		this.distanceComponent.cleanup()
		this.decayComponent.cleanup()
		this.angleComponent.cleanup()
		this.penumbraComponent.cleanup()
		this.targetComponent.cleanup()
	}
}

/*
Settings that only the HemisphereLight uses.
*/
spaciblo.components.HemisphereLightSettingsComponent = class extends k.Component {
	constructor(dataObject, options={}){
		super(dataObject, options)
		this.el.addClass('hemisphere-light-settings')

		this.el.appendChild(k.el.h3('Sky color'))
		this.skyColorComponent = new spaciblo.components.SceneNodeStringSettingComponent(this.dataObject, { fieldName: 'light-sky-color' })
		this.skyColorComponent.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.skyColorComponent.el)

		this.el.appendChild(k.el.h3('Ground color'))
		this.groundColorComponent = new spaciblo.components.SceneNodeStringSettingComponent(this.dataObject, { fieldName: 'light-ground-color' })
		this.groundColorComponent.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
		this.el.appendChild(this.groundColorComponent.el)
	}
	cleanup(){
		super.cleanup()
	}
}

/*
SceneGraphNodePositioningComponent provides an editor for a scene node's location and orientation
*/
spaciblo.components.SceneGraphNodePositioningComponent = class extends k.Component {
	constructor(dataObject, options={}){
		super(dataObject, options)
		this.el.addClass('scene-graph-node-positioning-component')
		this.el.addClass('scene-graph-node-property-component')

		this.vectorComponents = []

		for(let fieldName of spaciblo.api.PositioningSettingsNames){
			k.el.h4(be.ui.initialUpperCase(fieldName)).appendTo(this.el)
			let component = new spaciblo.components.VectorEditorComponent(this.dataObject, fieldName)
			component.addListener((...params) => { this.trigger(...params) }, spaciblo.events.NodeUpdated)
			this.el.appendChild(component.el)
			this.vectorComponents.push(component)
		}
	}
	cleanup(){
		super.cleanup()
		for(let component of this.vectorComponents){
			component.cleanup()
		}
	}
}

/*
SceneGraphNodeSettingComponent provides a key/value UI for editing.
This is an abstract class (see 'Not implemented' methods) used by SceneGraphNodeBooleanSettingComponent and other setting type components.
Settings are always string/string key-value pairs so extending classes parse and normalize these string values.
options:
	fieldName: the dataObject field name to use for this component
*/
spaciblo.components.SceneNodeSettingComponent = class extends k.Component {
	constructor(dataObject, options){
		super(dataObject, options)
		this.el.addClass('scene-node-setting-component')
		this.lastUpdateSent = Date.now()
		this._boundHandleModelChange = this._handleModelChange.bind(this)
		this.keyLabel = k.el.h3(this.options.fieldName).appendTo(this.el)
		this.dataObject.addListener(this._boundHandleModelChange, 'changed:' + this.options.fieldName)
	}
	cleanup(){
		super.cleanup()
		this.dataObject.removeListener(this._boundHandleModelChange)
	}
	get parsedInputValue() {
		// Extending classes should read their input UI and return a normalized value
		// Note that settings are always strings so the return value should always be a string
		throw 'Not implemented'
	}
	setFromModelValue(){
		// Extending classes should read the model value and update their input elements accordingly
		// Note that settings values are always strings, so parse accordingly
		throw 'Not implemented'
	}
	checkInputValue(){
		if(this.parsedInputValue === this.dataObject.get(this.options.fieldName)) return
		this.lastUpdateSent = Date.now()
		this.trigger(spaciblo.events.SettingUpdated, this.dataObject.get('id'), this.options.fieldName, this.parsedInputValue)
	}
	_handleModelChange(){
		if(this.parsedInputValue === this.dataObject.get(this.options.fieldName)) return
		if(Date.now() - this.lastUpdateSent < spaciblo.components.InputChangeDelay) return // Don't overwrite local editing
		this.setFromModelValue()
	}
}

/*
SceneGraphNodeBooleanSettingComponent provides a checkbox for a setting whose value is either 'true' or 'false'.
options:
	fieldName: the dataObject field name to use for this component
	defaultValue (false): the assumed value when the setting is empty, does not exist, or does not equal 'true' or 'false' 
*/

spaciblo.components.SceneGraphNodeBooleanSettingComponent = class extends spaciblo.components.SceneNodeSettingComponent {
	constructor(dataObject, options){
		super(dataObject, options)
		if(typeof this.options.defaultValue === 'undefined'){
			this.options.defaultValue = false
		} else {
			this.options.defaultValue = this.options.defaultValue === true || this.options.defaultValue === 'true'
		}
		this.checkbox = k.el.input({ type: 'checkbox' }).appendTo(this.el)
		this.listenTo('change', this.checkbox, ev => {
			this.checkInputValue()
		})

		this.setFromModelValue()
	}
	get parsedInputValue(){
		// Note: settings are always strings so we return strings
		return this.checkbox.checked ? 'true' : 'false'
	}
	setFromModelValue(){
		switch(this.dataObject.get(this.options.fieldName)){
			case 'true':
				this.checkbox.checked = true
				break
			case 'false':
				this.checkbox.checked = false
				break
			default:
				this.checkbox.checked = this.options.defaultValue
		}
	}
}


/*
SceneNodeStringSettingComponent provides a text input for editing a string component
All settings are strings, but some of them have known values (e.g. 'visible' can be empty, 'true', or 'false').
SceneNodeStringSettingComponent is for settings that should be editable as text.
options:
	fieldName: the dataObject field name to use for this component
*/
spaciblo.components.SceneNodeStringSettingComponent = class extends spaciblo.components.SceneNodeSettingComponent {
	constructor(dataObject, options){
		super(dataObject, options)
		this.valueInput = k.el.input({ type: 'text' }).appendTo(this.el)
		this.listenTo('keyup', this.valueInput, ev => {
			this.checkInputValue()
		})
		this.setFromModelValue()
	}
	get parsedInputValue(){
		return this.valueInput.value
	}
	setFromModelValue(){
		this.valueInput.value = this.dataObject.get(this.options.fieldName)
	}
}

/*
VectorEditorComponent renders a variable length array of numbers for editing
*/
spaciblo.components.VectorEditorComponent = class extends k.Component {
	constructor(dataObject, fieldName, defaultValue=[], localSave=false){
		super(dataObject, { fieldName: fieldName, defaultValue: defaultValue })
		this.el.addClass('vector-editor-component')
		this.localSave = localSave
		this._throttledLocalSave = be.ui.throttle(this._localSave, 1000, false, true)
		this.lastUpdateSent = Date.now()
		this._boundHandleModelChange = this._handleModelChange.bind(this)
		this.inputs = k.el.div().appendTo(this.el)
		this._setVector(...this.modelValue)
		this.dataObject.addListener(this._boundHandleModelChange, 'changed:' + this.options.fieldName)
	}
	get modelValue(){
		let val = this.dataObject.get(this.options.fieldName, this.options.defaultValue)
		if(!val) return []
		if(Array.isArray(val)) return val
		if(typeof val === 'string'){
			let results = []
			for(let token of val.split(',')){
				let f = parseFloat(token)
				results.push(Number.isNaN(f) ? 0 : f)
			}
			return results
		}
		console.error('unknown vector val', val)
		return []
	}
	cleanup(){
		super.cleanup()
		this.dataObject.removeListener(this._boundHandleModelChange)
	}
	_handleModelChange(...params){
		if(Date.now() - this.lastUpdateSent < spaciblo.components.InputChangeDelay) return // Don't overwrite local editing
		this._setVector(...this.modelValue)
	}
	_setVector(...params){
		while(this.inputs.children.length < params.length){
			let input = k.el.input({ type: 'text' })
			this.listenTo('keyup', input, this._handleKeyUp, this)
			this.inputs.appendChild(input)
		}
		for(let i=0; i < params.length; i++){
			this.inputs.children[i].value = params[i]
		}
	}
	_localSave(changes){
		this.dataObject.set(this.options.fieldName, changes.join(','))
		this.dataObject.save().catch(() => {
			console.error('error saving vector', this.options.fieldName, changes)
		})
	}
	_handleKeyUp(ev){
		let changes = this._getChanges()
		if(changes === null) return
		this.lastUpdateSent = Date.now()
		if(this.localSave){
			this._throttledLocalSave(changes)
		}
		this.trigger(spaciblo.events.NodeUpdated, this.dataObject.get('id'), this.options.fieldName, changes)
	}
	_getChanges(){
		// Returns a vector if input is different than the model, or null if they're the same
		let vector = []
		for(let i=0; i < this.inputs.children.length; i++){
			let f = parseFloat(this.inputs.children[i].value)
			if(Number.isNaN(f)){
				f = 0
			}
			vector.push(f)
		}
		let data = this.modelValue
		if(vector.length != data.length) return false
		if(vector.every((val, index) => { return val === data[index] })){
			return null
		}
		return vector
	}
}

/*
AvatarsEditorComponent shows a list of avatars and editable details for an avatar when it is selected
*/
spaciblo.components.AvatarsEditorComponent = class extends be.ui.ListAndDetailComponent {
	constructor(dataObject=null, options={}){
		super(dataObject, Object.assign({
			itemType: be.api.Avatar,
			itemComponent: spaciblo.components.AvatarItemComponent,
			detailComponent: spaciblo.components.AvatarDetailComponent
		}, options))
		this.el.addClass('avatars-editor-component')
		this.el.addClass('editor-component')
	}
}
/*
AvatarItemComponent is used as a list item in a list of Avatars 
*/
spaciblo.components.AvatarItemComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, Object.assign({ el: k.el.li() }, options))
		this.el.addClass('avatar-item-component')
		this.el.addClass('item-component')
		if(dataObject === null){
			throw 'AvatarItemComponent requires an Avatar dataObject'
		}
		this.nameEl = k.el.div().appendTo(this.el)
		this.bindText('name', this.nameEl, value => { 
			if(value === '' || value === null){ return 'Unnamed Avatar' }
			return value
		})
	}
}

/*
AvatarDetailComponent is used to show and edit the metadata of a Avatar
*/
spaciblo.components.AvatarDetailComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('avatar-detail-component')
		this.el.addClass('detail-component')

		this.nameInput = new be.ui.TextInputComponent(dataObject, 'name', { autosave: true })
		this.el.appendChild(this.nameInput.el)

		this.deleteLink = k.el.button({ class: 'small-button delete-button' }, 'Delete').appendTo(this.el)
		this.listenTo('click', this.deleteLink, this._handleDeleteClick, this)

		this.avatarPartList = new be.api.AvatarParts([], {
			'avatar-uuid': this.dataObject.get('uuid')
		})
		this.avatarPartListComponent = new be.ui.CollectionComponent(this.avatarPartList, {
			itemComponent: spaciblo.components.AvatarPartDetailComponent,
			itemOptions: { 'avatar-uuid': this.dataObject.get('uuid') }
		})
		this.avatarPartListComponent.el.addClass('avatar-part-list-component')
		this.el.appendChild(this.avatarPartListComponent.el)
		this.avatarPartList.fetch()

		this.addEl = k.el.div(
			{ class: 'add-item' },
			k.el.button({ class: 'small-button' }, 'Add')
		).appendTo(this.el)
		this.listenTo('click', this.addEl.querySelector('button'), this._handleAddClick, this)
	}
	cleanup(){
		super.cleanup()
		this.nameInput.cleanup()
	}
	_handleAddClick(){
		let item = new be.api.AvatarPart({}, { 'avatar-uuid': this.dataObject.get('uuid') })
		item.save().then(() => {
			this.avatarPartList.add(item)
		}).catch((...params) => {
			console.error('Error creating item', ...params)
		})
	}
	_handleDeleteClick(){
		this.dataObject.delete().then(() => {
			this.trigger('deleted', this)
		})
	}
}

/*
Used in a list in AvatarDetailComponent to allow editing an avatar part 
*/
spaciblo.components.AvatarPartDetailComponent = class extends k.Component {
	constructor(dataObject, options={}){
		super(dataObject, options)
		this.el.addClass('avatar-part-detail-component row')
		dataObject.options['avatar-uuid'] = options['avatar-uuid'] // Used when saving

		this.deleteLink = k.el.button({ class: 'small-button delete-button' }, 'Delete').appendTo(this.el)
		this.listenTo('click', this.deleteLink, this._handleDeleteClick, this)

		this.infoCol = k.el.div({ class: 'info-col col-3' }).appendTo(this.el)

		k.el.h3('Name').appendTo(this.infoCol)
		this.nameInput = new be.ui.TextInputComponent(dataObject, 'name', { autosave: true })
		this.infoCol.appendChild(this.nameInput.el)

		k.el.h3('Part').appendTo(this.infoCol)
		this.partInput = new be.ui.TextInputComponent(dataObject, 'part', { autosave: true })
		this.infoCol.appendChild(this.partInput.el)

		k.el.h3('Parent').appendTo(this.infoCol)
		this.parentInput = new be.ui.TextInputComponent(dataObject, 'parent', { autosave: true })
		this.infoCol.appendChild(this.parentInput.el)

		this.positioningCol = k.el.div({ class: 'positioning-col col-3' }).appendTo(this.el)

		this.positioningCol.appendChild(k.el.h3('Position'))
		this.positionComponent = new spaciblo.components.VectorEditorComponent(this.dataObject, 'position', [0,0,0], true)
		this.positioningCol.appendChild(this.positionComponent.el)

		this.positioningCol.appendChild(k.el.h3('Orientation'))
		this.orientationComponent = new spaciblo.components.VectorEditorComponent(this.dataObject, 'orientation', [0,0,0,1], true)
		this.positioningCol.appendChild(this.orientationComponent.el)

		this.positioningCol.appendChild(k.el.h3('Scale'))
		this.scaleComponent = new spaciblo.components.VectorEditorComponent(this.dataObject, 'scale', [1,1,1], true)
		this.positioningCol.appendChild(this.scaleComponent.el)

		this.templateCol = k.el.div({ class: 'template-col col-3' }).appendTo(this.el)

		this.templateComponent = new spaciblo.components.TemplateEditorComponent(this.dataObject)
		this.templateComponent.addListener((...params) => { this._handleNodeUpdated(...params) }, spaciblo.events.NodeUpdated)
		this.templateCol.appendChild(this.templateComponent.el)

		this.bufferCol = k.el.div({ class: 'col-2' }).appendTo(this.el)
	}
	cleanup(){
		super.cleanup()
		this.nameInput.cleanup()
		this.partInput.cleanup()
		this.parentInput.cleanup()
		this.positionComponent.cleanup()
	}
	_handleNodeUpdated(eventName, dataObjectId, fieldName, value){
		if(value === spaciblo.api.RemoveKeyIndicator){
			this.dataObject.set(fieldName, '')
		} else {
			this.dataObject.set(fieldName, value)
		}
		this.dataObject.save().catch((...params) => {
			console.error('Error updating avatar part template', ...params)
		})
	}
	_handleDeleteClick(){
		this.dataObject.delete().then(() => {
			this.trigger('deleted', this)
		}).catch((...params) => {
			console.error('error deleting an avatar part', ...params)
		})
	}
}

/*
TemplatesEditorComponent shows a list of templates and editable details for a template when it is selected
*/
spaciblo.components.TemplatesEditorComponent = class extends be.ui.ListAndDetailComponent {
	constructor(dataObject=null, options={}){
		super(dataObject, Object.assign({
			itemType: be.api.Template,
			itemComponent: spaciblo.components.TemplateItemComponent,
			detailComponent: spaciblo.components.TemplateDetailComponent
		}, options))
		this.el.addClass('templates-editor-component')
		this.el.addClass('editor-component')
	}
}

/*
TemplateItemComponent is used as a list item in a list of Templates 
*/
spaciblo.components.TemplateItemComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, Object.assign({ el: k.el.li() }, options))
		this.el.addClass('template-item-component')
		this.el.addClass('item-component')
		if(dataObject === null){
			throw 'TemplateItemComponent requires a Template dataObject'
		}

		this.templateImageComponent = new spaciblo.components.TemplateImage(dataObject)
		this.el.appendChild(this.templateImageComponent.el)

		this.nameEl = k.el.div({ class: 'name' }).appendTo(this.el)
		this.bindText('name', this.nameEl)
	}
}

/*
TemplateDetailComponent is used to show and edit the metadata of a Template
*/
spaciblo.components.TemplateDetailComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('template-detail-component')
		this.el.addClass('detail-component')
		if(dataObject === null) throw 'TemplateDetailComponent requires a Template dataObject'

		this.row = k.el.div({ class: 'row' }).appendTo(this.el)
		this.leftCol = k.el.div({ class: 'col-3' }).appendTo(this.row)
		this.rightCol = k.el.div({ class: 'col-9' }).appendTo(this.row)

		this.templateDataTextEditor = null
		this.templateRenderer = new spaciblo.three.TemplateRenderer(this.dataObject)
		this.rightCol.appendChild(this.templateRenderer.el)

		this.snapTemplateButton = k.el.button('Snap').appendTo(this.rightCol)
		this.snapTemplateButton.addEventListener('click', ev => {
			let imageData = this.templateRenderer.getCanvasImage()
			let templateImage = new be.api.TemplateImage({ image: imageData }, { uuid: this.dataObject.get('uuid') })
			templateImage._new = false
			templateImage.save().then(resultData => {
				if(resultData.data && resultData.data.image){
					this.dataObject.set('image', resultData.data.image)
				}
			}).catch((...params) => {
				console.error('error saving', ...params)
			})
		})

		k.el.h3('Name').appendTo(this.leftCol)
		this.nameInput = new be.ui.TextInputComponent(dataObject, 'name', { autosave: true })
		this.leftCol.appendChild(this.nameInput.el)

		k.el.h3('Geometry').appendTo(this.leftCol)
		this.geometryInput = new be.ui.TextInputComponent(dataObject, 'geometry', { autosave: true })
		this.leftCol.appendChild(this.geometryInput.el)

		k.el.h3('Client Script').appendTo(this.leftCol)
		this.clientScriptInput = new be.ui.TextInputComponent(dataObject, 'clientScript', { autosave: true })
		this.leftCol.appendChild(this.clientScriptInput.el)

		/*
		k.el.h3('Sim Script (TODO)').appendTo(this.leftCol)
		this.simScriptInput = new be.ui.TextInputComponent(dataObject, 'simScript', { autosave: true })
		this.leftCol.appendChild(this.simScriptInput.el)
		*/

		k.el.h3('Parent').appendTo(this.leftCol)
		this.parentInput = new be.ui.TextInputComponent(dataObject, 'parent', { autosave: true })
		this.leftCol.appendChild(this.parentInput.el)

		k.el.h3('Part').appendTo(this.leftCol)
		this.partInput = new be.ui.TextInputComponent(dataObject, 'part', { autosave: true })
		this.leftCol.appendChild(this.partInput.el)

		this.dropTarget = new be.ui.FileDropTarget()
		this.dropTarget.addListener((...params) => { this._handleFilesDropped(...params) }, be.events.FilesDropped)
		this.leftCol.appendChild(this.dropTarget.el)

		this.templateDataList = new be.api.TemplateDataList([], {
			uuid: this.dataObject.get('uuid')
		})
		this.templateDataListComponent = new be.ui.CollectionComponent(this.templateDataList, {
			itemComponent: spaciblo.components.TemplateDataItemComponent,
			itemOptions: { templateUUID: this.dataObject.get('uuid') }
		})
		this.templateDataListComponent.el.addClass('template-data-list-component')
		this.leftCol.appendChild(this.templateDataListComponent.el)
		this.templateDataList.fetch()
		this.templateDataList.addListener(this._handleTemplateDataClicked.bind(this), spaciblo.events.TemplateDataItemSelected)

		this.addTemplateDataForm = k.el.form().appendTo(this.leftCol)
		this.templateDataNameInput = k.el.input({
			placeholder: 'data file name'
		}).appendTo(this.addTemplateDataForm)
		this.addTemplateDataSubmit = k.el.button('add').appendTo(this.addTemplateDataForm)
		this.listenTo('click', this.addTemplateDataSubmit, ev =>{
			ev.preventDefault()
			let name = this.templateDataNameInput.value.trim()
			if(name === '') return false
			this.templateDataNameInput.value = ''
			this._hideTemplateDataForm()
			this.templateDataList.create({ name: name }).catch((...params) => {
				console.error('error', ...params)
			})
			return false
		})
		this.addTemplateDataLink = k.el.button({ class: 'add-template-data-link small-button' }, '+').appendTo(this.leftCol)
		this.listenTo('click', this.addTemplateDataLink, ev => {
			this._showTemplateDataForm()
		})
		this._hideTemplateDataForm()

		this.deleteLink = k.el.button({ class: 'small-button delete-button' }, 'Delete').appendTo(this.el)
		this.listenTo('click', this.deleteLink, this._handleDeleteClick, this)

		setTimeout(this.updateSize.bind(this), 0)
		window.addEventListener('resize', () => { this.updateSize() })
	}
	handleAddedToDOM(){
		this.updateSize()
	}
	updateSize(){
		this.templateRenderer.setSize(this.rightCol.offsetWidth, 400)
	}
	cleanup(){
		super.cleanup()
		this.templateRenderer.cleanup()
		this.nameInput.cleanup()
		this.geometryInput.cleanup()
		this.parentInput.cleanup()
		this.partInput.cleanup()
		this.dropTarget.cleanup()
	}
	_hideTemplateDataForm(){
		this.addTemplateDataForm.style.display = 'none'
		this.addTemplateDataLink.style.display = 'block'
	}
	_showTemplateDataForm(){
		this.addTemplateDataForm.style.display = 'block'
		this.addTemplateDataLink.style.display = 'none'
	}
	_handleTemplateDataClicked(eventName, templateData){
		if(templateData.get('name').toLowerCase().endsWith('.js')){
			this._showDataTextEditor(templateData)
		}
	}
	_showDataTextEditor(templateData){
		if(this.templateDataTextEditor !== null){
			this.templateDataTextEditor.el.remove()
		}
		this.templateDataTextEditor = new spaciblo.components.TemplateDataTextEditor(templateData, { template: this.dataObject })
		this.rightCol.appendChild(this.templateDataTextEditor.el)
	}
	_handleDeleteClick(){
		this.dataObject.delete().then(() => {
			this.trigger('deleted', this)
		})
	}
	_handleFilesDropped(eventName, component, files){
		let fileCount = files.length
		for(let file of files){
			be.api.TemplateData.postFile(this.dataObject.get('uuid'), file).then((...params) => {
				fileCount -= 1
				if(fileCount == 0){
					this.templateDataList.fetch()
					this.templateRenderer.reloadTemplate()
				}
			}).catch((...params) => {
				console.error('Error', ...params)
				fileCount -= 1
				if(fileCount == 0){
					this.templateDataList.fetch()
					this.templateRenderer.reloadTemplate()
				}
			})
		}
	}
}

/*
Watches a Template's 'image' field and displays an img element if it is set
*/
spaciblo.components.TemplateImage = class extends k.Component {
	constructor(dataObject, options={}){
		super(dataObject, options)
		this.el.addClass('template-image')

		this.image = k.el.img().appendTo(this.el)
		this._updateImage()

		this.dataObject.addListener(() => {
			this._updateImage()
		}, 'changed:image')
	}
	_updateImage(){
		if(this.dataObject.get('image')){
			this.templateImage = new be.api.TemplateImage({}, { uuid: this.dataObject.get('uuid') })
			if(this.image.src) {
				this.image.src = this.templateImage.url + '?cache-buster=' + Math.random()
			} else {
				this.image.src = this.templateImage.url
			}
			this.image.style.display = ''
		} else {
			this.templateImage = null
			this.image.style.display = 'none'
		}
	}
}

/*
A basic text editor for text data from TemplateData objects
*/
spaciblo.components.TemplateDataTextEditor = class extends k.Component {
	constructor(dataObject, options={}){
		super(dataObject, options)
		this.el.addClass('template-data-text-editor')
		this.isFullScreen = false

		this.uiWrapper = k.el.div({ class: 'template-data-text-editor-ui-wrapper'})
		this.el.appendChild(this.uiWrapper)

		this.textEl = k.el.textarea()
		this.textEl.spellcheck = false
		this.uiWrapper.appendChild(this.textEl)
		this.listenTo('keydown', this.textEl, ev => {
			if(ev.keyCode !== 9) return true
			ev.preventDefault()
			if (document.selection) {
				// IE
				var sel = document.selection.createRange();
				sel.text = '	';
			} else if (this.textEl.selectionStart || this.textEl.selectionStart === 0) {
				// Others
				var startPos = this.textEl.selectionStart;
				var endPos = this.textEl.selectionEnd;
				this.textEl.value = this.textEl.value.substring(0, startPos) + '	' + this.textEl.value.substring(endPos, this.textEl.value.length);
				this.textEl.selectionStart = startPos + 1;
				this.textEl.selectionEnd = startPos + 1;
			} else {
				this.textEl.value += '	';
			}
			return false
		})

		this.saveButton = k.el.button({
			class: 'save-button',
			accesskey: 's'
		}, 'save')
		this.uiWrapper.appendChild(this.saveButton)
		this.listenTo('click', this.saveButton, ev => { 
			this.dataObject.saveText(this.options.template.get('uuid'), this.textEl.value)
		})

		this.fullScreenButton = k.el.button('full screen')
		this.uiWrapper.appendChild(this.fullScreenButton)
		this.listenTo('click', this.fullScreenButton, this._toggleFullScreen.bind(this))

		this.dataObject.getData(options.template.get('uuid')).then(data => {
			this.textEl.value = data
		}).catch(err => {
			console.error(err)
		})

		this.dataObject.addListener(() => {
			this.el.remove()
			this.cleanup()
		}, 'deleted', true)
	}
	_toggleFullScreen(ev){
		if(this.isFullScreen){
			this.isFullScreen = false
			document.body.removeChild(this.uiWrapper)
			this.el.appendChild(this.uiWrapper)
			this.uiWrapper.removeClass('full-screen')
		} else {
			this.isFullScreen = true
			this.el.removeChild(this.uiWrapper)
			document.body.appendChild(this.uiWrapper)
			this.uiWrapper.addClass('full-screen')
		}
	}
}

/*
TemplateDataItemComponent renders a TemplateData as part of a list
*/
spaciblo.components.TemplateDataItemComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('template-data-item-component')
		this.el.addClass('item-component')
		this.nameEl = k.el.span(dataObject.get('name'))
		this.el.appendChild(this.nameEl)
		this.deleteLink = k.el.button({ class: 'small-button' }, 'x').appendTo(this.el)
		this.listenTo('click', this.deleteLink, this._handleDeleteClick, this)
		this.listenTo('click', this.nameEl, this._handleClick, this)
	}
	_handleClick(){
		this.dataObject.collection.trigger(spaciblo.events.TemplateDataItemSelected, this.dataObject)
	}
	_handleDeleteClick(ev){
		ev.preventDefault()
		this.dataObject.set('uuid', this.options.templateUUID)
		this.dataObject.delete()
		return false
	}
}
