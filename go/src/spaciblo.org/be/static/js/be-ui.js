'use strict'

var be = be || {}
be.ui = be.ui || {}
be.events = be.events || {}

be.events.LoginSuccessful = 'be-login-successful'
be.events.Resetting = 'be-resetting'
be.events.Reset = 'be-reset'
be.events.FilesDropped = 'be-files-dropped'

/*
Generate a form for use in a bootstrap style form.
Pass an inputType of "static" if it should just be a display field.
*/
be.ui.generateInputFormGroup = function(inputType, name, id, label, placeholder){
	var formGroup = k.el.div({'class':'form-group input-form-group'})
	if(label){
		formGroup.appendChild(k.el.label({
			'for':name,
			'class':'control-label'
		}, label))
	}
	if(inputType == 'static'){
		var input = k.el.span({
			'id':id,
			'class':'form-control-static'
		})
	} else if(inputType == 'textarea'){
		var input = k.el.textarea({
			'id':id,
			'class':'form-control',
			'placeholder':placeholder
		})
	} else {
		var input = k.el.input({
			'id':id,
			'type':inputType,
			'class':'form-control',
			'placeholder':placeholder
		})
	}
	formGroup.appendChild(k.el.div({'class':'input-wrapper'}, input))
	return formGroup
}

be.ui.FileDropTarget = class extends k.Component {
	constructor(options={ label: 'Drop files here' }){
		super(null, options)
		this.el.addClass('file-drop-target')
		this.label = k.el.div({
			class: 'label'
		}, options.label || '').appendTo(this.el)

		this.el.addEventListener('dragover', ev => { this._handleDragOver(ev) }, false)
		this.el.addEventListener('dragexit', ev => { this._handleDragExit(ev) }, false)
		this.el.addEventListener('drop', ev => { this._handleDrop(ev) }, false)
	}
	_handleNewFiles(files){
		console.log('Files', files)
		this.trigger(be.events.FilesDropped, this, files)
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
}

/*
TextInputComponent exposes a DataModel's field for editing via text input
*/
be.ui.TextInputComponent = class extends k.Component {
	constructor(dataObject, fieldName, options={}){
		super(dataObject, Object.assign({ el: k.el.input() }, options))
		this._throttledSave = be.ui.throttle(this._save, 1000, false, true)
		this.el.addClass('data-text-input')
		this.el.addClass('form-control')
		this._fieldName = fieldName
		this._boundHandleModelChange = this._handleModelChange.bind(this)
		this.dataObject.addListener(this._boundHandleModelChange, `change:${this._fieldName}`)
		this.el.value = this.dataObject.get(this._fieldName)
		this.listenTo('keyup', this.el, this._handleKeyup, this)
	}
	get value(){
		return this.el.value
	}
	get _valueEqualsModel(){
		return this.el.value === this.dataObject.get(this._fieldName)
	}
	_handleKeyup(ev){
		if(this._valueEqualsModel) return
		this.dataObject.set(this._fieldName, this.el.value)
		this._throttledSave()
	}
	_handleModelChange(ev){
		if(this._valueEqualsModel) return
		this.el.value = this.dataObject.get(this._fieldName)
	}
	_save(){
		this.dataObject.save()
	}
	cleanup(){
		super.cleanup()
		this.dataObject.removeListener(this._boundHandleModelChange)
	}
}

/*
CollectionComponent provides a generic list UI for DataCollections.
Options:
	itemComponent (be.ui.DefaultItemComponent): a k.Component class used to render each item in this list
	itemOptions ({}): a set of options to pass to each item Component
	onClick (null): a function to call with the dataObject whose item Component is clicked
*/
be.ui.CollectionComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('be-collection-component')
		if(dataObject instanceof k.DataCollection === false) throw 'CollectionComponent requires a DataCollection dataObject'
		this._inGroupChange = false // True while resetting or other group change
 		this._dataObjectComponents = new Map() // dataObject.id -> k.Component

		this._ul = k.el.ul().appendTo(this.el)

		this.dataObject.addListener(() => { this._reset() }, 'reset')
		if(this.dataObject.isNew === false){
			this._reset()
		}
	}
	at(index){
		// Returns the Component at index, or null if index is out of bounds
		if(index < 0) return null
		if(index >= this._ul.children.length) return null
		return this._ul.children.item(index).component
	}
	_reset(){
		this._inGroupChange = true
		this.trigger(be.events.Resetting, this)
		for(let [_, itemComponent] of this._dataObjectComponents){
			this._remove(itemComponent)
		}
		this._dataObjectComponents.clear()
		for(let dataObject of this.dataObject){
			this._add(this._createItemComponent(dataObject))
		}
		this._inGroupChange = false
		this.trigger(be.events.Reset, this)
	}
	_handleItemClick(ev, itemComponent){
		if(this.options.onClick){
			ev.preventDefault()
			this.options.onClick(itemComponent.dataObject)
		}
	}
	_add(itemComponent){
		this._dataObjectComponents.set(itemComponent.dataObject.get('id'), itemComponent)
		this._ul.appendChild(itemComponent.el)
		if(this.options.onClick){
			itemComponent.el.addEventListener('click', (ev) => { this._handleItemClick(ev, itemComponent) })
		}
		itemComponent.dataObject.addListener(this._handleDeleted.bind(this), 'deleted', true)
	}
	_remove(itemComponent){
		this._dataObjectComponents.delete(itemComponent.dataObject.get('id'))
		this._ul.removeChild(itemComponent.el)
		itemComponent.el.removeEventListener('click', null)
		itemComponent.cleanup()
	}
	_handleDeleted(eventName, dataObject, error){
		if(error) return
		let component = this._dataObjectComponents.get(dataObject.get('id'))
		if(component){
			this._remove(component)
		}
	}
	_createItemComponent(itemDataObject){
		if(this.options.itemOptions){
			var options = Object.assign({}, this.options.itemOptions)
		} else {
			var options = {}
		}
		if(this.options.itemComponent){
			return new this.options.itemComponent(itemDataObject, options)
		} else {
			return new be.ui.DefaultItemComponent(itemDataObject, options)
		}
	}
}

be.ui.DefaultItemComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, Object.assign({ el: k.el.li() }, options))
		if(dataObject === null) throw 'DefaultItemComponent requires a dataObject'
		this.el.appendChild(k.el.span('Item: ' + dataObject))
	}
}

/*
TopNavComponent renders the top navigation links as well as login/out links.
*/
be.ui.TopNavComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('top-nav-component')
		this.nav = k.el.nav().appendTo(this.el)
		this.siteName = k.el.a(
			{ href: '/' },
			k.el.h1('Spaciblō')
		).appendTo(this.nav)

		this.rightLinks = k.el.ul(
			{ class: 'right-links'},
			k.el.li(k.el.a({ href: '/a/' }, 'account'))
		).appendTo(this.nav)

		if(be.currentUser.isNew){
			be.currentUser.addListener((...params) => {
				if(be.currentUser.get('staff') === true){
					this._addStaffLinks()
				}
			}, 'reset', true)
		} else if (be.currentUser.get('staff') === true) {
			this._addStaffLinks()
		}

	}
	_addStaffLinks(){
		this.addLink('/i/', 'inventory', 'inventory-nav')
	}
	addLink(href, anchorText, className) {
		this.rightLinks.append(k.el.li(k.el.a({ 'href': href, 'class': className }, anchorText )))
	}
}

/*
LoginComponent renders the email and password form to allow the user to authenticate
*/
be.ui.LoginComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('login-component')

		this.errorMessage = k.el.div({ class: 'error' }).appendTo(this.el)
		this.errorMessage.style.display = 'none'

		this.emailFormGroup = be.ui.generateInputFormGroup(
			'text',
			'email', 'email',
			'Email', 'Email'
		)

		this.passwordFormGroup = be.ui.generateInputFormGroup(
			'password',
			'password', 'password',
			'Password', 'Password'
		)

		this.submitButton = k.el.button({
			'type':'submit'
		}, 'Login')
		this.submitGroup = k.el.div(
			{ class: 'form-group submit-group' },
			this.submitButton
		)

		this.form = k.el.form(
			{ class: 'form' },
			this.emailFormGroup,
			this.passwordFormGroup,
			this.submitGroup
		).appendTo(this.el)
		this.form.addEventListener('submit', this.handleSubmit.bind(this))
	}
	handleSubmit(ev){
		ev.preventDefault()
		let email = this.emailFormGroup.querySelector('input').value
		let password = this.passwordFormGroup.querySelector('input').value
		if(email === '' || password === ''){
			this.showError('Please enter an email and password.')
			return
		}
		this.hideError()
		this.clearInput()
		be.api.login(email, password).then(([status, data]) => {
			this.handleLoginSuccess(status, data)
		}).catch((...params) => {
			this.handleLoginFailure(...params)
		})
	}
	clearInput(){
		this.emailFormGroup.querySelector('input').value = ''
		this.passwordFormGroup.querySelector('input').value = ''
	}
	hideError(){
		this.errorMessage.style.display = 'none'
	}
	showError(message){
		this.errorMessage.innerText = message
		this.errorMessage.style.display = 'block'
	}
	handleLoginSuccess(status, data){
		if(status === 200){
			this.trigger(be.events.LoginSuccessful)
		} else {
			this.showError('Could not log in with that email and password')
		}
	}
	handleLoginFailure(...params){
		console.error('Error', ...params)
	}
}

be.ui.throttle = function(func, wait, leading=true, trailing=true) {
	// Cribbed from https://github.com/jashkenas/underscore
	var timeout, context, args, result
	var previous = 0

	var later = function() {
		previous = leading === false ? 0 : Date.now()
		timeout = null
		result = func.apply(context, args)
		if (!timeout) context = args = null
	}

	var throttled = function() {
		var now = Date.now()
		if (!previous && leading === false) previous = now
		var remaining = wait - (now - previous)
		context = this
		args = arguments
		if (remaining <= 0 || remaining > wait) {
		if (timeout) {
			clearTimeout(timeout)
			timeout = null
		}
		previous = now
		result = func.apply(context, args)
		if (!timeout) context = args = null
		} else if (!timeout && trailing !== false) {
		timeout = setTimeout(later, remaining)
		}
		return result
	}

	throttled.cancel = function() {
		clearTimeout(timeout)
		previous = 0
		timeout = context = args = null
	}

	return throttled
}