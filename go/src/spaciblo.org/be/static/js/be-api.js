"use strict"

var be = be || {}
be.api = be.api || {}
be.schema = be.schema || {}
be.events = be.events || {}

be.API_VERSION = '0.1.0';

be.currentUser = null // This will be populated when the schema is loaded

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
Authenticate with the back-end.
Returns a promise that resolves to [http status code, response data]
On successful response, it will resolve to [200, <user data>]
On unsuccessful response, it will resolve to [400, <error data>]
*/
be.api.login = function(email, password){
	return new Promise(function(resolve, reject){
		const url = `/api/${be.API_VERSION}/user/current`
		const data = JSON.stringify({
			'email': email,
			'password': password
		})
		var headers = new Headers()
		headers.set('Accept', be.schema.acceptFormat + be.API_VERSION)
		let fetchOptions = {
			method: 'post',
			body: data,
			headers: headers,
			credentials: 'same-origin' // So that cookies are sent and handled when received
		}
		let responseStatus = -1
		fetch(url, fetchOptions).then(response => {
			responseStatus = response.status
			if(response.status === 200 || response.status === 400){
				return response.json()
			} else {
				throw 'Login failed with status ' + response.status
			}
		}).then(data => {
			if(responseStatus === 200){
				be.currentUser.reset(data)
			}
			resolve([responseStatus, data])
		}).catch(err => {
			reject(err)
		})
	})
}

/*
logout asks the service to terminate delete the session cookie
This also resets be.currentUser so that dependent UIs can react
*/
be.api.logout = function(){
	return new Promise(function(resolve, reject){
		const url = `/api/${be.API_VERSION}/user/current`
		var headers = new Headers()
		headers.set('Accept', be.schema.acceptFormat + be.API_VERSION)
		let fetchOptions = {
			method: 'delete',
			headers: headers,
			credentials: 'same-origin' // So that cookies are sent and handled when received
		}
		fetch(url, fetchOptions).then(response => {
			localStorage.removeItem('user')
			be.currentUser.reset({})
			resolve()
		}).catch(err => {
			reject(err)
		})
	})
}

/*
Returns true if the session cookie exists
*/
be.api.hasSession = function(){
	let sessionCookie = be.getCookie(be.api.sessionCookie)
	return sessionCookie !== null && sessionCookie !== ''
}

be.getCookie = function(name) {
    if (document.cookie && document.cookie != '') {
        let cookies = document.cookie.split(';')
        for (let i = 0; i < cookies.length; i++) {
            let cookie = cookies[i].trim()
            if (cookie.substring(0, name.length + 1) == (name + '=')) {
                return decodeURIComponent(cookie.substring(name.length + 1))
            }
        }
    }
    return null
}

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
		super([], options)
		this.options.dataObject = this.dataObjectClass
		if(data !== null && data.length > 0){
			this.reset(data)
		}
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
			headers: headers,
			credentials: 'same-origin'
		}
	}
	get url(){
		return be.schema._generateURL(this.schema.get('path'), this.options);
	}
}

// The abstract class extended by all models in be.api
be.schema.BaseEndpointModel = class extends k.DataModel {
	get fetchOptions(){
		var headers = new Headers()
		headers.set('Accept', be.schema.acceptFormat + be.API_VERSION)
		return {
			headers: headers,
			credentials: 'same-origin' // So that cookies are sent and handled when received
		}
	}
	get url(){
		return be.schema._generateURL(this.schema.get('path'), this.data);
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
		// Set up the be.currentUser
		if(localStorage.user){
			try  {
				be.currentUser = new be.api.User(JSON.parse(localStorage.user))
			} catch (e) {
				be.currentUser = new be.api.User()
			}
		} else {
			be.currentUser = new be.api.User()
		}
		be.currentUser.addListener(() => {
			localStorage.user = JSON.stringify(be.currentUser.data);
		}, 'reset')

		// Ask the server for the authed user info
		new be.api.CurrentUser().fetch().then(currentUser => {
			be.currentUser._new = false
			be.currentUser.reset(currentUser.data)
		}).catch((...params) => {
			be.currentUser._new = false
			be.currentUser.reset({})
		})

		// Announce that the schema is ready for use
		document.dispatchEvent(be.events.SchemaPopulatedEvent)
	}).catch((...params) => {
		console.error("Error fetching API schema", ...params)
	})
})


