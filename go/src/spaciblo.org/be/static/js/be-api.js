"use strict"

var be = be || {}
be.api = be.api || {}
be.schema = be.schema || {}
be.events = be.events || {}

be.API_VERSION = '0.1.0';

be.events.registerDOMEvent = function(eventName, humanReadableName=eventName){
	var event = new CustomEvent(humanReadableName)
	event.initEvent(eventName, true, true)
	return event
}

// Triggered on the document when the API schema is populated and has created base models and collections
be.events.SchemaPopulated = 'schema-populated'
be.events.SchemaPopulatedEvent = be.events.registerDOMEvent(be.events.SchemaPopulated, 'SchemaPopulated')

// Used by the authentication mechanism
be.api.sessionCookie = "be_auth"
be.api.emailCookie = "be_email"

be.schema.acceptFormat = "application/vnd.api+json; version="

be.schema.pathVariablesRegex = new RegExp('{[^{]+}', 'g');

/*
SchemaModel fetches data on each endpoint and generates the models and collections in be.api
*/
be.schema.SchemaModel = class extends k.DataModel {
	constructor(data={}, options={}){
		super(data, options)
		this.addListener(() => { this._populate() }, "fetched")
	}
	get url(){
		return `/api/${be.API_VERSION}/schema`
	}
	_populate(){
		// Generate a model or collection for each endpoint
		this.endpoints = new be.schema.EndpointCollection(this.get('endpoints'))
		for(let endpoint of this.endpoints){
			if(endpoint.isList()){
				continue // Generate the models first so we can use them when generating the collections
			}
			be.api[endpoint.objectifyName()] = endpoint.generateDataObject()
		}
		for(let endpoint of this.endpoints){
			if(endpoint.isList() == false){
				continue // We already generated the models
			}
			be.api[endpoint.objectifyName()] = endpoint.generateDataObject()
		}
	}
}

// EndpointModel holds data describing an API endpoint
be.schema.EndpointModel = class extends k.DataModel {
	generateDataObject(){
		if(this.isList()){
			var clz = class extends be.schema.BaseEndpointCollection {}
		} else {
			var clz = class extends be.schema.BaseEndpointModel {}
		}
		clz.prototype.schema = this
		return clz
	}
	isList(){
		if(this._getProperty('limit') == null) return false
		if(this._getProperty('offset') == null) return false
		if(this._getProperty('objects') == null) return false
		return true
	}
	objectifyName(){
		return be.schema._objectifyName(this.get('name'))
	}
	get childrenType(){
		let objectsProperty = this._getProperty('objects')
		if(objectsProperty && objectsProperty['children-type']){
			return objectsProperty['children-type']
		}
		return null
	}
	_getProperty(name){
		var properties = this.get('properties')
		for(let prop of properties){
			if(prop.name == name){
				return prop
			}
		}
		return null
	}
}

// EndpointCollection holds a list of EndpointModels. Used by SchemaModel when populating be.api
be.schema.EndpointCollection = class extends k.DataCollection {
	constructor(data=[], options={}){
		super(data, Object.assign({ dataObject: be.schema.EndpointModel }, options))
	}
}

// The abstract class extended by all collections in be.api
be.schema.BaseEndpointCollection = class extends k.DataCollection {
	constructor(data=[], options={}){
		super(data, options)
		// TODO figure out how to set the dataObject before data is parsed
		this.options.dataObject = this.dataObjectClass
	}
	get dataObjectClass(){
		var childrenType = this.schema.childrenType
		if(childrenType != null && typeof be.api[be.schema._objectifyName(childrenType)] === 'function'){
			return be.api[be.schema._objectifyName(childrenType)]
		}
		return k.DataModel
	}
	parse(response){
		this.offset = response.offset;
		this.limit = response.limit;
		return response.objects;
	}
	get fetchOptions(){
		var headers = new Headers()
		headers.set('Accept', be.schema.acceptFormat + be.API_VERSION)
		return {
			headers: headers
		}
	}
	get url(){
		return be.schema._generateURL(this.schema.get('path'), this.options);
	}
}

// The abstract class extended by all models in be.api
be.schema.BaseEndpointModel = class extends k.DataModel {
	get url(){
		return be.schema._generateURL(this.schema.get('path'), this.options);
	}
}

be.schema._objectifyName = function(name){
	if(!name) return null
	let tokens = name.split('-')
	let result = ""
	for(let i=0; i < tokens.length; i++){
		result += be.schema._initialCap(tokens[i])
	}
	return result
}

be.schema._initialCap = function(val){
	return val[0].toUpperCase() + val.substring(1);
}


be.schema._generateURL = function(path, attributes){
	var tokens = path.match(be.schema.pathVariablesRegex);
	if(tokens == null || tokens.length == 0) {
		return path;
	}
	var result = "";
	var index = 0;
	for(let i=0; i < tokens.length; i++){
		let tokenIndex = path.indexOf(tokens[i]);
		result += path.substring(index, tokenIndex);
		index = tokenIndex + tokens[i].length;
		var name = tokens[i].substring(1, tokens[i].length - 1).split(':')[0];
		if(typeof attributes[name] != 'undefined'){
			result += attributes[name]
		}
	}
	if(index < path.length){
		result += path.substring(index);
	}
	return result;	
}

// Send a be.events.SchemaPopulated event when pages can depend on the scheme to be loaded
document.addEventListener("DOMContentLoaded", function(){
	be.schema.Schema = new be.schema.SchemaModel()
	be.schema.Schema.fetch().then(() => {
		document.dispatchEvent(be.events.SchemaPopulatedEvent)
	}).catch(() => {
		console.error("Error fetching API schema", arguments)
	})
})

