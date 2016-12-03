// TODO Rewrite this in ES6 with PotassiumJS

var be = be || {};
be.api = be.api || {};
be.schema = be.schema || {};
be.events = be.events || {};

// Used by the authentication mechanism
be.api.sessionCookie = "be_auth";
be.api.emailCookie = "be_email";

be.events.SchemaPopulated = 'populated';
be.events.LoggedIn = 'logged-in';
be.events.LoggedOut = 'logged-out';

be.schema.pathVariablesRegex = new RegExp('{[^{]+}', 'g');
be.schema.acceptFormat = "application/vnd.api+json; version="
be.schema.propertyTypes = ['string', 'long-string', 'int', 'float', 'array', 'object', 'bool']

be.schema.generateURL = function(path, attributes){
		var tokens = path.match(be.schema.pathVariablesRegex);
		if(tokens == null || tokens.length == 0) {
			return path;
		}
		var result = "";
		var index = 0;
		for(var i=0; i < tokens.length; i++){
			var tokenIndex = path.indexOf(tokens[i]);
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

// Add the API version to the XHR headers when syncing models or collections
be.schema.versionedSync = function(method, model, options){
	var beforeSend = options.beforeSend;
	var version = this.version;
	options.beforeSend = function(xhr) {
		xhr.setRequestHeader('Accept', be.schema.acceptFormat + version);
		if (beforeSend) return beforeSend.apply(this, arguments);
	};
	Backbone.Model.prototype.sync.apply(this, arguments);
}

// Attached to file Models to ease the pain of posting form data
be.schema.sendForm = function(method, formData, successCallback, errorCallback){
	$.ajax({
		url: this.url(),
		data: formData,
		headers :  {
			'Accept': be.schema.acceptFormat + window.API_VERSION
		},
		cache: false,
		contentType: false,
		processData: false,
		type: method,
		success: successCallback,
		error: errorCallback
	});
}

be.schema.fileTypeForProperty = function(propertyName){
	for(var i=0; i < this.schema.properties.length; i++){
		if(this.schema.properties[i].name == propertyName){
			return this.schema.properties[i]['file-type'] || null;
		}
	}
	return null;
}

be.schema.Collection = Backbone.Collection.extend({
	initialize: function(options){
		this.options = options;
	},
	parse: function(response){
		this.offset = response.offset;
		this.limit = response.limit;
		return response.objects;
	},
	url: function(){
		return be.schema.generateURL(this.schema.path, this.options);
	},
	comparator: 'id',
	sync: be.schema.versionedSync
});

be.schema.Model = Backbone.Model.extend({
	initialize: function(options){
		this.options = options;
	},
	url: function(){
		return be.schema.generateURL(this.schema.path, this.attributes);
	},
	sync: be.schema.versionedSync,
	rawGet: function(parameterMap, successCallback, errorCallback){
		var parameters = [];
		for(var key in parameterMap){
			parameters[parameters.length] = encodeURIComponent(key) + '=' + encodeURIComponent(parameterMap[key]);
		}
		var url = this.url();
		if(parameters.length > 0){
			url += '?' + parameters.join('&');
		}
		$.ajax({
			url: url,
			method: 'get',
			headers :  {
				'Accept': be.schema.acceptFormat + window.API_VERSION
			},
			success: successCallback,
			error: errorCallback
		});
	}
});

be.schema.Schema = Backbone.Model.extend({
	initialize: function(options){
		_.bindAll(this, 'populate', 'hasProperties', 'isStaff', 'populate', 'findAPIByName', 'getProperty', 'hasProperties');
		this.options = options;
		this.user = null; // Will be set to schema.api.User if the session is authenticated
		this.api = {}; // This is where we will put the Backbone Models and Collections populated from the schema
		this.populated = false;
		if(!this.options.url){
			throw 'Schema requires you to pass in a "url" option';
		}
		this.on('sync', this.populate);
	},
	url: function(){
		return this.options.url;
	},
	isStaff: function(){
		if(this.user == null) return false;
		return this.user.get('staff') === true;
	},
	populate: function(){
		this.version = this.get('api').version;
		for(var i in this.attributes.endpoints){
			var endpoint = this.attributes.endpoints[i];
			if(this.hasProperties(endpoint['properties'], ['offset', 'limit', 'objects']) == true){
				continue;
			}
			var name = be.schema.objectifyEndpointName(endpoint['name']);
			this.api[name] = be.schema.Model.extend({
				'schema':endpoint,
				'version':this.version,
				'sendForm': be.schema.sendForm,
				'fileTypeForProperty': be.schema.fileTypeForProperty
			});
		}

		for(var i in this.attributes.endpoints){
			var endpoint = this.attributes.endpoints[i];
			if(this.hasProperties(endpoint['properties'], ['offset', 'limit', 'objects']) == false){
				continue;
			}

			var model = null;
			var objectsProperty = this.getProperty(endpoint.properties, 'objects');
			if(objectsProperty && objectsProperty['children-type']){
				var childName = be.schema.objectifyEndpointName(objectsProperty['children-type']);
				if(this.api[childName]){
					model = this.api[childName];
				}
			}

			var name = be.schema.objectifyEndpointName(endpoint['name']);
			this.api[name] = be.schema.Collection.extend({
				'schema':endpoint,
				'model':model,
				'version':this.version
			});
		}
		this.populated = true;
		this.trigger(be.events.SchemaPopulated, this);
	},
	findAPIByName: function(name){
		var objectName = be.schema.objectifyEndpointName(name);
		if(this.api[objectName]){
			return this.api[objectName];
		}
		return null;
	},
	getProperty: function(properties, name){
		for(var i=0; i < properties.length; i++){
			if(properties[i].name == name){
				return properties[i];
			}
		}
		return null;
	},
	hasProperties: function(properties, names) {
		for(var i=0; i < names.length; i++){
			var found = false;
			for(var j=0; j < properties.length; j++){
				if(properties[j].name == names[i]){
					found = true;
					break;
				}
			}
			if(!found) return false;
		}
		return true;
	}
});

be.schema.objectifyEndpointName = function(name){
	if(!name) return null;
	var tokens = name.split('-');
	result = "";
	for(var i=0; i < tokens.length; i++){
		result += be.schema.initialCap(tokens[i]);
	}
	return result;
}

be.schema.initialCap = function(val){
	return val[0].toUpperCase() + val.substring(1);
}

// TODO stop hard coding the API version number here
window.API_VERSION = "0.1.0";

$(document).ready(function(){
	window.schema = new be.schema.Schema({'url':'/api/' + window.API_VERSION + '/schema'});
	window.schema.on(be.events.SchemaPopulated, function(){
		if(localStorage.user){
			window.schema.user = new window.schema.api.User(JSON.parse(localStorage.user));
			// Update the localStorage
			window.schema.user.on('sync', function(){
				localStorage.user = JSON.stringify(window.schema.user.attributes);
			});
		} else {
			window.schema.user = null;
		}
	});
	window.schema.fetch();
})

/*
Returns true if the session cookie exists
This depends on the jquery.cookie plugin: https://github.com/carhartl/jquery-cookie

*/
be.api.loggedIn = function(){
	return !!$.cookie(be.api.sessionCookie);
}

/*
	Connect to the API and authenticate
*/
be.api.login = function(email, password, successCallback, errorCallback){
	$.ajax({
		url: '/api/' + window.API_VERSION + '/user/current',
		method: 'post',
		contentType: 'application/json',
		data: JSON.stringify({
			'email': email,
			'password': password
		}),
		headers :  {
			'Accept': be.schema.acceptFormat + window.API_VERSION
		},
		error: function(jqXHR, status, error) {
			if (errorCallback) {
				errorCallback.apply(this, arguments);
			}
		},
		success: function(data, status, jqXHR) {
			localStorage.user = JSON.stringify(data); // Used to populate window.schema.user
			if(window.schema){
				if(window.schema.user){
					window.schema.user.set(data);
				} else {
					window.schema.user = new window.schema.api.User(data);
					window.schema.user.on('sync', function(){
						localStorage.user = JSON.stringify(window.schema.user.attributes);
					});
				}
				window.schema.trigger(be.events.LoggedIn);
			}
			if (successCallback) {
				successCallback.apply(this, arguments);
			}
		}
	});
}

/*
	Deauthenticate 
*/
be.api.logout = function(successCallback, errorCallback){
	$.ajax({
		url: '/api/' + window.API_VERSION + '/user/current',
		method: 'delete',
		headers :  {
			'Accept': be.schema.acceptFormat + window.API_VERSION
		},
		error: function(jqXHR, status, error) {
			if (errorCallback) {
				errorCallback.apply(this, arguments);
			}
		},
		success: function(data, status, jqXHR) {
			// Delete the localStorage
			localStorage.removeItem('user');
			if(window.schema){
				window.schema.user = null;
				window.schema.trigger(be.events.LoggedOut);
			}
			if (successCallback) {
				successCallback.apply(this, arguments);
			}
		}
	});
}