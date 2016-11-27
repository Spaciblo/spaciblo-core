"use strict"
/*
	PotassiumES is a reactive element framework.
	It handles server backed data: k.DataModel and k.DataCollection
	It handles UI logic: k.Component
	It includes a DOM manipulation tool: k.el
	It has a test suite in potassium-test.js
	
	See https://github.com/TrevorFSmith/potassium/ for documentation and examples.
*/

var k = {} // PotassiumES root object, named k because that is potassium's symbol on the periodic table of elements

/*
	EventListener holds information about listeners on an object with the eventMixin
*/
k.EventListener = class {
	constructor(eventName, callback, once=false){
		this.eventName = eventName
		this.callback = callback
		this.once = once
	}
	matches(eventName){
		return this.eventName === k.ALL_EVENTS || eventName === this.eventName
	}
	distributeEvent(eventName, ...params){
		if(this.matches(eventName)){
			this.callback(eventName, ...params)
			return true
		}
		return false
	}
}

k.ALL_EVENTS = Symbol("all events")

/*
	Mix in k.eventMixin to enable the instances to track event listeners and send them events
	Use it like so: var YourClass = k.eventMixin(class { ... })
	See k.DataObject for an example.
*/
k.eventMixin = Base => class extends Base {
	// Send an event to listeners
	trigger(eventName, ...params){
		var listenersToRemove = [];
		for(let listener of this.listeners){
			if(listener.distributeEvent(eventName, ...params) && listener.once){
				listenersToRemove.push(listener);
			}
		}
		for(let listener of listenersToRemove){
			this.removeListener(listener.callback, listener.eventName)
		}
	}
	addListener(callback, eventName=k.ALL_EVENTS, once=false){
		this.listeners.push(new k.EventListener(eventName, callback, once))
	}
	removeListener(callback, eventName=null){
		let remove = false
		for(var i=0; i < this.listeners.length; i++){
			remove = false
			if(this.listeners[i].callback === callback){
				if(eventName == null){
					remove = true
				} else if(this.listeners[i].matches(eventName)) {
					remove = true
				}
			}
			if(remove){
				this.listeners.splice(i, 1)
				i -= 1
			}
		}
	}
	clearListeners(){
		this._listeners.length = 0
	}
	get listeners(){
		// Returns an array of EventListener instances
		if(typeof this._listeners == "undefined"){
			this._listeners = []
		}
		return this._listeners
	}
	clearListeners(){
		if(this._listeners){
			this._listeners.length = 0
		}
	}
}

/*
	The parent class for k.DataModel and k.DataCollection
	It holds the event mixin and the generic function of fetching data from a remote service
*/
k.DataObject = k.eventMixin(class {
	constructor(options={}){
		this.options = options
	}
	cleanup(){
		this.clearListeners()
	}

	// Return the URL (relative or full) as a string for the endpoint used by this.fetch
	get url(){
		throw new Error("Extending classes must implement url()")
	}

	// Clear out old data and set it to data
	reset(data={}){
		throw new Error("Extending classes must implement reset")
	}
	parse(data){
		// Extending classes can override this to parse the data received via a fetch
		return data
	}
	equals(obj){
		// Extending classes can override this to allow less strict equality
		return this === obj
	}
	fetch(){
		// Ask the server for data for this model or collection
		return new Promise(function(resolve, reject){
			this.trigger("fetching", this)
			fetch(this.url).then(response => response.json()).then(data => {
				data = this.parse(data)
				this.reset(data)
				this.trigger("fetched", this, data, null)
				resolve()
			}).catch(err => {
				this.trigger("fetched", this, null, err)
				reject(err)
			})
		}.bind(this))
	}
})

k._NO_CHANGE = Symbol("no change")

/*
	DataModel holds a map of string,value pairs, sometimes fetched from or sent to a back-end server.
	It fires events when values are changed.

	options:
		fieldDataObjects ({}): a map of fieldName (string) to k.DataObject (class), used to create sub-object in this Model's data
*/
k.DataModel = class extends k.DataObject {
	constructor(data={}, options={}){
		super(options)
		if(typeof this.options.fieldDataObjects === "undefined"){
			this.options.fieldDataObjects = {}
		}
		this.data = {}
		this.setBatch(data)
	}
	cleanup() {
		super.cleanup()
		this.data = null
	}
	/* 
		Find a value held within this k.DataModel. 
		Return values may be native types or, if mapped by options.fieldDataObjects, another k.DataObject
	*/
	get(fieldName, defaultValue=null){
		if(typeof this.data[fieldName] === "undefined" || this.data[fieldName] === null || this.data[fieldName] === ""){
			return defaultValue
		}
		return this.data[fieldName]
	}
	// Set a key/value pair.
	set(fieldName, value){
		var batch = {}
		batch[fieldName] = value
		return this.setBatch(batch)
	}
	/*
		Set a group of values. The 'values' parameter should be an object that works in for(key in values) loops like a dictionary: {}
		If a key is in options.fieldDataObjects then the value will be used to contruct a k.DataObject and that will be the saved value.
	*/
	setBatch(values){
		let changes = {}
		let changed = false
		for(let key in values){
			let result = this._set(key, values[key])
			if(result !== k._NO_CHANGE){
				changed = true
				changes[key] = result
				this.trigger(`changed:${key}`, this, key, result)
			}
		}
		if(changed){
			this.trigger("changed", this, changes)
		}
		return changes
	}
	increment(fieldName, amount=1){
		const currentVal = fieldName in this.data ? this.data[fieldName] : 0
		this.set(fieldName, currentVal + amount)
	}
	_set(fieldName, data){
		// _set does not fire any events, so you probably want to use set or setBatch
		if(data instanceof k.DataObject){
			if(this.data[fieldName] instanceof k.DataObject){
				this.data[fieldName].reset(data.data)
			} else {
				this.data[fieldName] = data
			}
		} else if(this.options.fieldDataObjects[fieldName]){
			if(this.data[fieldName]){
				this.data[fieldName].reset(data)
			} else {
				this.data[fieldName] = new this.options.fieldDataObjects[fieldName](data)
			}
		} else {
			if(this.data[fieldName] === data){
				return k._NO_CHANGE
			}
			if(this.data[fieldName] instanceof k.DataObject){
				this.data[fieldName].reset(data)
			} else {
				this.data[fieldName] = data
			}
		}
		return this.data[fieldName]
	}
	reset(data={}){
		for(var key in this.data){
			if(typeof data[key] === "undefined"){
				this.data[key] = null
			}
		}
		this.setBatch(data)
	}
	equals(obj){
		if(obj === null || typeof obj === "undefined") return false
		if(this === obj) return true
		if(typeof obj !== typeof this) return false
		if(obj.get('id') === this.get('id')) return true
		return false
	}
}

/*
	DataCollection represents an ordered list of k.DataModel instances

	options:
		dataObject (DataModel): the k.DataObject extending class to use to wrap each data item in this collection
*/
k.DataCollection = class extends k.DataObject {
	constructor(data=[], options={}){
		super(options)
		this._inReset = false
		this._inAddBatch = false
		this._boundRelayListener = this._relayListener.bind(this)
		this.dataObjects = []
		for(let datum of data){
			this.add(this.generateDataObject(datum))
		}
	}
	cleanup(){
		super.cleanup()
		for(let obj of this.dataObjects){
			obj.removeListener(this._boundRelayListener)
		}
		this.dataObjects.length = 0
	}
	at(index){
		if(index < 0 || index > this.dataObjects.length - 1){
			throw new Error("Index out of range: ${index}")
		}
		return this.dataObjects[index]
	}
	add(dataObject){
		if(dataObject instanceof k.DataObject == false){
			dataObject = this.generateDataObject(dataObject)
		}
		if(this.dataObjects.indexOf(dataObject) !== -1){ // TODO stop using indexOf because equality doesn't work
			return
		}
		this.dataObjects.push(dataObject)
		this.trigger("added", this, dataObject)
		if(this._comparator && this._inReset == false && this._inAddBatch == false){
			this.sort(this._comparator)
		}
		dataObject.addListener(this._boundRelayListener)
	}
	_relayListener(...params){
		this.trigger(...params)
	}
	// Add an array of k.DataObjects to the end of the collection
	addBatch(dataObjects){
		this._inAddBatch = true
		for(let dataObject in dataObjects){
			if(dataObject instanceof k.DataObject == false){
				dataObject = this.generateDataObject(dataObject)
			}
			this.add(dataObject)
		}
		this._inAddBatch = false
	}
	indexOf(dataObject){
		for(var i=0; i < this.dataObjects.length; i++){
			if(this.dataObjects[i].equals(dataObject)){
				return i
			}
		}
		return -1
	}
	remove(dataObject){
		let index = this.indexOf(dataObject)
		if(index === -1){
			return
		}
		this.dataObjects[index].removeListener(this._boundRelayListener)
		this.dataObjects.splice(index, 1)
		this.trigger("removed", this, dataObject)
	}
	reset(data){
		this._inReset = true
		for(let obj of this.dataObjects.slice()){
			this.remove(obj)
		}
		for(let datum of data){
			this.add(this.generateDataObject(datum))
		}
		this._inReset = false
		if(this._comparator){
			this.sort(this._comparator)
		}
		this.trigger("reset", this)
	}
	sort(comparator=k.DataCollection.defaultComparator){
		this.dataObjects.sort(comparator)
		this.trigger("sorted", this)
	}
	sortByAttribute(attributeName, comparator=k.defaultComparator){
		this.sort((obj1, obj2) => {
			return comparator(obj1.get(attributeName), obj2.get(attributeName))
		})
	}
	keepSortedByField(fieldName, comparator=k.defaultComparator){
		this._comparator = (obj1, obj2) => {
			return comparator(obj1.get(fieldName), obj2.get(fieldName))
		}
		this.addListener(() => {
			if(this._comparator && this._inReset == false && this._inAddBatch == false){
				this.sort(this._comparator)
			}
		}, "changed:" + fieldName)
	}
	*[Symbol.iterator](){
		for(let obj of this.dataObjects){
			yield obj
		}
	}
	get length(){
		return this.dataObjects.length
	}
	generateDataObject(data){
		let options = { collection: this }
		if(this.options.dataObject){
			return new this.options.dataObject(data, options)
		}
		return new k.DataModel(data, options)
	}
}
k.DataCollection.defaultComparator = function(dataObject1, dataObject2){
	if(dataObject1 === dataObject2) return 0
	if(typeof dataObject1.equals === "function" && dataObject1.equals(dataObject2)) return 0
	let val1 = dataObject1.get("id", -1)
	let val2 = dataObject2.get("id", -1) 
	if(val1 === val2) return 0
	if(val1 < val2) return -1
	return 1
}

/*
	Component holds the reactive logic for a DOM element
*/
k.Component = k.eventMixin(class {
	constructor(dataObject=null, options={}){
		this.dataObject = dataObject // a k.DataModel or k.DataCollection
		this.options = options
		if(typeof this.options.el !== "undefined"){
			this.el = this.options.el
		} else {
			this.el = k.el.div()
		}
		this.boundCallbacks = [] // { callback, dataObject } to be unbound during cleanup
		this.domEventCallbacks = [] // { callback, eventName, targetEl } to be unregistered during cleanup
		this._el.component = this
	}
	cleanup(){
		this.clearListeners()
		for(let bindInfo of this.boundCallbacks){
			bindInfo.dataObject.removeListener(bindInfo.callback)
		}
		for(let domInfo of this.domEventCallbacks){
			domInfo.targetEl.removeEventListener(domInfo.eventName, domInfo.callback)
		}
	}
	// The root DOM element
	get el(){ 
		return this._el
	}
	set el(domElement){
		if(!domElement || domElement.nodeType !== 1){
			throw new Error(`Tried to set a non-DOM element to Component.el: ${domElement}: ${domElement.nodeType}`)
		}
		if(this._el){
			delete this._el["component"]
		}
		this._el = domElement
		this._el.component = this
		this.trigger(k.Component.ElementChangedEvent, this, this._el)
	}
	/*
		Listen to a DOM event.
		For example:
			this.buttonEl = k.el.button()
			this.listenTo("click", this.buttonEl, this.handleClick)
	*/
	listenTo(eventName, targetEl, callback, context=this){
		let boundCallback = context === null ? callback : callback.bind(context)
		let info = {
			eventName: eventName,
			targetEl: targetEl,
			originalCallback: callback,
			context: context,
			callback: boundCallback
		}
		targetEl.addEventListener(eventName, info.callback)
		this.domEventCallbacks.push(info)
	}
	/*
		Set the targetElement.innerText to the value of dataObject.get(fieldName) as it changes
		dataObject defaults to this.dataObject but can be any k.DataModel or k.DataCollection
		formatter defaults to the identity function but can be any function that accepts the value and returns a string
	*/
	bindText(fieldName, targetElement, formatter=null, dataObject=this.dataObject){
		if(formatter === null){
			formatter = (value) => {
				if(value === null) return ""
				if(typeof value === "string") return value
				return "" + value
			}
		}
		let callback = () => {
			let result = formatter(dataObject.get(fieldName))
			targetElement.innerText = typeof result === "string" ? result : ""
		}
		dataObject.addListener(callback, `changed:${fieldName}`)
		callback()
		this.boundCallbacks.push({
			callback: callback,
			dataObject: dataObject
		})
	}
	/*
		Set the attributeName attribute of targetElement to the value of dataObject.get(fieldName) as it changes
		formatter defaults to the identity function but can be any function that accepts the value and returns a string
	*/
	bindAttribute(fieldName, targetElement, attributeName, formatter=null, dataObject=this.dataObject){
		if(formatter === null){
			formatter = (value) => {
				if(value === null) return ""
				if(typeof value === "string") return value
				return "" + value
			}
		}
		let callback = () => {
			targetElement.setAttribute(attributeName, formatter(dataObject.get(fieldName)))
		}
		dataObject.addListener(callback, `changed:${fieldName}`)
		callback()
		this.boundCallbacks.push({
			callback: callback,
			dataObject: dataObject
		})
	}
})
k.Component.ElementChangeEvent = "element-changed"

/*
	Router maps window.history events and URL path fragments to events
	For example, routing /^blog\/([0-9]+)\/page\/([0-9a-z]+)$/ to an event with parameters for blog and page IDs
*/
k.Router = k.eventMixin(class {
	constructor(){
		this.routes = [];
		this.hashListener = this._checkHash.bind(this)
        window.addEventListener('hashchange', this.hashListener, false)
	}
	cleanup(){
		window.removeEventListener('hashchange', this.hashListener)
	}
	addRoute(regex, eventName, ...parameters){
		this.routes.push(new k._Route(regex, eventName, ...parameters))
	}
	start(){
		this._checkHash()
	}
	_checkHash(){
		this._handleNewPath(document.location.hash.slice(1))
	}
	_handleNewPath(path){
		for(let route of this.routes){
			let matches = route.matches(path)
			if(matches == null){
				continue
			}
			this.trigger(route.eventName, ...matches, ...route.parameters)
			return
		}
		this.trigger(k.Router.UnknownRouteEvent, path)
	}
})
k.Router.RouteAddedEvent = "route-added"
k.Router.StartedRoutingEvent = "started-routing"
k.Router.UnknownRouteEvent = "unknown-route"

/*
	_Route tracks routes for k.Router
*/
k._Route = class {
	constructor(regex, eventName, ...parameters){
		this.regex = regex
		this.eventName = eventName
		this.parameters = parameters

	}
	matches(path){
		return path.match(this.regex)
	}
}

/*
	Functions that generate DOM elements like k.el.div(...) will live in k.el
*/
k.el = {}

// This comparator that stringifies the passed values and returns the comparison of those values
k.defaultComparator = function(el1, el2){
	if(el1 === el2) return 0
	let str1 = "" + el1
	let str2 = "" + el2
	if(str1 == str2) return 0
	if(str1 < str2) return -1
	return 1
}

/*
	domElementFunction is the behind the scenes logic for the functions like k.el.div(...)
	Below you will find the loop that uses domElementFunction
*/
k.el.domElementFunction = function(tagName, ...params){
	// Create a boring DOM element
	let el = document.createElement(tagName)

	// A convenience function to allow chaining like `let fooDiv = k.el.div().appendTo(document.body)`
	el.appendTo = function(parent){
		parent.appendChild(this)
		return this
	}

	// A convenience function to allow appending strings, dictionaries of attributes, arrays of subchildren, or children
	el.append = function(child=null){
		if(child === null){ return }
		if(typeof child === "string"){
			this.appendChild(document.createTextNode(child))
		} else if(Array.isArray(child)){
			for(let subChild of child){
				this.append(subChild)
			}
		// If it's an object but not a DOM element, consider it a dictionary of attributes
		} else if(typeof child === "object" && typeof child.nodeType === "undefined"){
			for(let key in child){
				if(child.hasOwnProperty(key) == false){
					continue
				}
				this.setAttribute(key, child[key])
			}
		} else {
			this.appendChild(child)
		}
		return this
	}

	/*
	Sort el.children *in place* using the comparator function
	See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort for an explanation of the comparator function
	*/
	el.sort = function(comparator=k.defaultComparator){
		// Populate the holding array while removing children from the DOM
		let holdingArray = [];
		while(this.children.length > 0){
			holdingArray.push(this.removeChild(this.children.item(0)))
		}
		holdingArray.sort(comparator)
		for(let child of holdingArray){
			this.appendChild(child);
		}
	}

	el.sortByAttribute = function(attributeName, comparator=k.defaultComparator){
		this.sort((el1, el2) => {
			return comparator(el1.getAttribute(attributeName), el2.getAttribute(attributeName))
		})
	}

	// Convenience functions to add and remove classes from this element without duplication
	el.addClass = function(className){
		const classAttribute = this.getAttribute("class") || ""
		const classes = classAttribute.split(/\s+/)
		if(classes.indexOf(className) != -1){
			// Already has that class
			return this
		}
		this.setAttribute("class", (classAttribute + " " + className).trim())
		return this
	}
	el.removeClass = function(className){
		let classAttribute = this.getAttribute("class") || ""
		const classes = classAttribute.split(/\s+/)
		const index = classes.indexOf(className)
		if(index == -1){
			// Already does not have that class
			return this
		}
		classes.splice(index, 1)
		classAttribute = classes.join(" ").trim()
		if(classAttribute.length == 0){
			this.removeAttribute("class")
		} else {
			this.setAttribute("class", classes.join(" ").trim())
		}
		return this
	}

	// Append the children parameters
	for(let child of params){
		el.append(child)
	}
	return el
}

/* 
	The tag names that will be used below to generate all of the element generating functions like k.el.div(...)
	These names were ovingly copied from the excellent Laconic.js 
	https://github.com/joestelmach/laconic/blob/master/laconic.js
*/
k.el.TAGS = ['a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b',
	'base', 'bdo', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption',
	'cite', 'code', 'col', 'colgroup', 'command', 'datalist', 'dd', 'del',
	'details', 'dfn', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset',
	'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5',
	'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img',
	'input', 'ins', 'keygen', 'kbd', 'label', 'legend', 'li', 'link', 'map',
	'mark', 'menu', 'meta', 'meter', 'nav', 'noscript', 'object', 'ol',
	'optgroup', 'option', 'output', 'p', 'picture', 'param', 'pre', 'progress', 
	'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section', 'select', 
	'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup', 
	'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title',
	'tr', 'ul', 'var', 'video', 'wbr']

// This loop generates the element generating functions like k.el.div(...)
for(let tag of k.el.TAGS){
	let innerTag = tag
	k.el[innerTag] = function(...params){
		return k.el.domElementFunction(innerTag, ...params)
	}
}

