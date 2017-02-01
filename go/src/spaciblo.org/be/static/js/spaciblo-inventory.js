'use strict'

var spaciblo = spaciblo || {}
spaciblo.events = spaciblo.events || {}
spaciblo.components = spaciblo.components || {}

spaciblo.events.SettingUpdated = 'spaciblo-setting-updated'
spaciblo.events.NodeUpdated = 'spaciblo-node-updated'
spaciblo.events.TemplatePicked = 'spaciblo-template-picked'
spaciblo.events.NodeRemoved = 'spaciblo-node-removed'

/* 
The number of miliseconds after input to ignore model updates so that
we don't overrite local edits with updates
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
		this.router.addRoute(/^spaces$/, 'spaces')
		this.router.addRoute(/^avatars$/, 'avatars')

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

		this.spaces = new be.api.Spaces()
		this.spacesEditorComponent = new spaciblo.components.SpacesEditorComponent(this.spaces)
		this.el.appendChild(this.spacesEditorComponent.el)

		this.avatarsEditorComponent = new spaciblo.components.AvatarsEditorComponent()
		this.el.appendChild(this.avatarsEditorComponent.el)

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
			case 'spaces':
				this._showSpaces()
				break
			case 'avatars':
				this._showAvatars()
				break
			default:
				console.error('Unknown route', eventName, ...params)
				this._showTemplates()
		}
	}
	_showTemplates(){
		this._clearDisplay()
		this.templatesEditorComponent.el.style.display = 'block'
		this.templatesButton.addClass('selected')
		if(this.templates.isNew){
			this.templates.fetch()
		}
	}
	_showSpaces(){
		this._clearDisplay()
		this.spacesEditorComponent.el.style.display = 'block'
		this.spacesButton.addClass('selected')
		if(this.spaces.isNew){
			this.spaces.fetch()
		}
	}
	_showAvatars(){
		this._clearDisplay()
		this.avatarsEditorComponent.el.style.display = 'block'
		this.avatarsButton.addClass('selected')
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
		this.bindText('name', this.nameEl)
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
		this.objectMap = new Map() // node id -> spaciblo.components.SceneGraphNode
		this.client = new spaciblo.api.Client()
		this.receivedFirstUpdate = false
		this.clientUUID = null
		this.rootNode = null
		this.selectedNode = null 
		this.client.addListener(this._boundHandleClientMessages, spaciblo.events.ClientMessageReceived)
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
				this.el.appendChild(node.el)
			} else {
				parent.addChild(node)
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
		this.client.sendAddNode(node.dataObject.get('id'), '', [0,0,0], [0,0,0,1])
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
		if(typeof update.templateUUID !== 'undefined'){
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
		return this.dataObject.get('name', this.dataObject.get('clientUUID', '')) || 'Unnamed'
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

		this.templateComponent = new spaciblo.components.SceneGraphNodeTemplateComponent(this.dataObject)
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

		this.removeButton = k.el.button({ class: 'delete-node-button small-button' }, 'x').appendTo(this.el)
		this.listenTo('click', this.removeButton, () => {
			this.trigger(spaciblo.events.NodeRemoved, this.dataObject.get('id'))
		})

		this.el.appendChild(k.el.h3('Settings'))

		for(let key in this.dataObject.data){
			if(spaciblo.api.IgnoredSettings.indexOf(key) != -1) continue
			if(spaciblo.api.PositioningSettingsNames.indexOf(key) != -1) continue
			if(spaciblo.api.LightingSettingsNames.indexOf(key) != -1) continue
			let settingComponent = new spaciblo.components.SceneNodeSettingComponent(this.dataObject, { fieldName: key })
			settingComponent.addListener((...params) => { this.trigger(...params) }, spaciblo.events.SettingUpdated)
			this.settingsMap.set(key, settingComponent)
			this.el.appendChild(settingComponent.el)
		}
	}
	cleanup(){
		super.cleanup()
		for(let [key, value] of this.settingsMap){
			this.settingsMap.get(key).cleanup()
		}
	}
}

/*
SceneGraphNodeTemplateComponent provides an editor of a node's template
*/
spaciblo.components.SceneGraphNodeTemplateComponent = class extends k.Component {
	constructor(dataObject){
		super(dataObject)
		this.el.addClass('scene-graph-node-template-component')
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
			let uuid = this.dataObject.get('templateUUID');
			if(uuid === spaciblo.api.RemoveKeyIndicator || !uuid){
				this.template.reset({})
				this._updateTemplate()
			} else {
				this.template.reset({ 'uuid': uuid})
				this.template.fetch().then(() => {
					this._updateTemplate()
				}).catch((...params) => {
					console.error('error', ...params)
				})
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

		this.commonSettings = k.el.div({ class: 'common-settings' }).appendTo(this.el)

		this.commonSettings.appendChild(k.el.h3('Intensity'))
		this.intensityInput = k.el.input().appendTo(this.commonSettings)
		this.listenTo('keyup', this.intensityInput, () => {
			this._handleSettingInputChange('light-intensity', this.intensityInput.value, '')
		}, this)

		this.commonSettings.appendChild(k.el.h3('Color'))
		this.colorInput = k.el.input().appendTo(this.commonSettings)
		this.listenTo('keyup', this.colorInput, () => {
			this._handleSettingInputChange('light-color', this.colorInput.value, '')
		}, this)

		this.dataObject.addListener(this._boundHandleModelChange, 'changed:light-type')
		this.dataObject.addListener(this._boundHandleModelChange, 'changed:light-intensity')
		this.dataObject.addListener(this._boundHandleModelChange, 'changed:light-color')
		this._updateFromModel()
	}
	cleanup(){
		super.cleanup()
		this.dataObject.removeListener(this._boundHandleModelChange)
	}
	get _radioValue(){
		for(let child of this.typeRadioGroup.querySelectorAll('input')){
			if(child.checked === true){
				return child.getAttribute('value') || ''
			}
		}
		return ''
	}
	_handleSettingInputChange(fieldName, value, defaultValue){
		if(this.dataObject.get(fieldName, defaultValue) === value) return
		this.trigger(spaciblo.events.SettingUpdated, this.dataObject.get('id'), fieldName, value)
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
		this.intensityInput.value = this.dataObject.get('light-intensity', '')
		this.colorInput.value = this.dataObject.get('light-color', '')

		if(lightType !== ''){
			this.commonSettings.style.display = 'block'
		} else {
			this.commonSettings.style.display = 'none'
		}
	}
}

/*
SceneGraphNodePositioningComponent provides an editor for a scene node's location and orientation
*/
spaciblo.components.SceneGraphNodePositioningComponent = class extends k.Component {
	constructor(dataObject){
		super(dataObject)
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
SceneGraphNodeSettingComponent provides a key/value table row for editing 
*/
spaciblo.components.SceneNodeSettingComponent = class extends k.Component {
	constructor(dataObject, options){
		super(dataObject, options)
		this.lastUpdateSent = Date.now()
		this.el.addClass('scene-node-setting-component')
		this._boundHandleModelChange = this._handleModelChange.bind(this)
		this.keyInput = k.el.h3(this.options.fieldName).appendTo(this.el)
		this.valueInput = k.el.input({ type: 'text' }).appendTo(this.el)
		this.listenTo('keyup', this.valueInput, this._handleKeyUp, this)
		this.valueInput.value = this.dataObject.get(this.options.fieldName)
		this.dataObject.addListener(this._boundHandleModelChange, 'changed:' + this.options.fieldName)
	}
	cleanup(){
		super.cleanup()
		this.dataObject.removeListener(this._boundHandleModelChange)
	}
	_handleModelChange(){
		if(this.dataObject.get(this.options.fieldName) === this.valueInput.value) return
		if(Date.now() - this.lastUpdateSent < spaciblo.components.InputChangeDelay) return // Don't overwrite local editing
		this.valueInput.value = this.dataObject.get(this.options.fieldName)
	}
	_handleKeyUp(ev){
		if(this.valueInput.value === this.dataObject.get(this.options.fieldName)) return
		this.lastUpdateSent = Date.now()
		this.trigger(spaciblo.events.SettingUpdated, this.dataObject.get('id'), this.options.fieldName, this.valueInput.value)
	}
}

/*
VectorEditorComponent renders a variable length array of numbers for editing
*/
spaciblo.components.VectorEditorComponent = class extends k.Component {
	constructor(dataObject, fieldName){
		super(dataObject, { fieldName: fieldName })
		this.lastUpdateSent = Date.now()
		this.el.addClass('vector-editor-component')
		this._boundHandleModelChange = this._handleModelChange.bind(this)
		this.inputs = k.el.div().appendTo(this.el)
		this._setVector(...this.dataObject.get(this.options.fieldName))
		this.dataObject.addListener(this._boundHandleModelChange, 'changed:' + this.options.fieldName)
	}
	cleanup(){
		super.cleanup()
		this.dataObject.removeListener(this._boundHandleModelChange)
	}
	_handleModelChange(...params){
		if(Date.now() - this.lastUpdateSent < spaciblo.components.InputChangeDelay) return // Don't overwrite local editing
		this._setVector(...this.dataObject.get(this.options.fieldName))
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
	_handleKeyUp(ev){
		let changes = this._getChanges()
		if(changes === null) return
		this.lastUpdateSent = Date.now()
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
		let data = this.dataObject.get(this.options.fieldName)
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
spaciblo.components.AvatarsEditorComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('avatars-editor-component')
		this.el.addClass('editor-component')

		this.row = k.el.div({
			class: 'row'
		}).appendTo(this.el)
		this.leftCol = k.el.div({
			class: 'col-2'
		}).appendTo(this.row)
		this.rightCol = k.el.div({
			class: 'col-10'
		}).appendTo(this.row)

		k.el.div('Avatars editor will go here').appendTo(this.rightCol)
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
		this.nameEl = k.el.div().appendTo(this.el)
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

		k.el.h3('Name').appendTo(this.el)
		this.nameInput = new be.ui.TextInputComponent(dataObject, 'name', { autosave: true })
		this.el.appendChild(this.nameInput.el)

		k.el.h3('Source').appendTo(this.el)
		this.sourceInput = new be.ui.TextInputComponent(dataObject, 'source', { autosave: true })
		this.el.appendChild(this.sourceInput.el)

		k.el.h3('Parent').appendTo(this.el)
		this.parentInput = new be.ui.TextInputComponent(dataObject, 'parent', { autosave: true })
		this.el.appendChild(this.parentInput.el)

		k.el.h3('Part').appendTo(this.el)
		this.partInput = new be.ui.TextInputComponent(dataObject, 'part', { autosave: true })
		this.el.appendChild(this.partInput.el)

		this.dropTarget = new be.ui.FileDropTarget()
		this.dropTarget.addListener((...params) => { this._handleFilesDropped(...params) }, be.events.FilesDropped)
		this.el.appendChild(this.dropTarget.el)

		this.templateDataList = new be.api.TemplateDataList([], {
			uuid: this.dataObject.get('uuid')
		})
		this.templateDataListComponent = new be.ui.CollectionComponent(this.templateDataList, {
			itemComponent: spaciblo.components.TemplateDataItemComponent,
			itemOptions: { templateUUID: this.dataObject.get('uuid') }
		})
		this.templateDataListComponent.el.addClass('template-data-list-component')
		this.el.appendChild(this.templateDataListComponent.el)
		this.templateDataList.fetch()

		this.deleteLink = k.el.button({ class: 'small-button delete-button' }, 'Delete').appendTo(this.el)
		this.listenTo('click', this.deleteLink, this._handleDeleteClick, this)
	}
	cleanup(){
		super.cleanup()
		this.nameInput.cleanup()
		this.sourceInput.cleanup()
		this.parentInput.cleanup()
		this.partInput.cleanup()
		this.dropTarget.cleanup()
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
				}
			}).catch((...params) => {
				console.error('Error', ...params)
				fileCount -= 1
				if(fileCount == 0){
					this.templateDataList.fetch()
				}
			})
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
		this.el.appendChild(k.el.span(dataObject.get('name')))
		this.deleteLink = k.el.button({ class: 'small-button' }, 'x').appendTo(this.el)
		this.listenTo('click', this.deleteLink, this._handleDeleteClick, this)
	}
	_handleDeleteClick(){
		this.dataObject.set('uuid', this.options.templateUUID)
		this.dataObject.delete()
	}
}
