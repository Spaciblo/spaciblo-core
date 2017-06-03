'use strict'

/*
spaciblo-api-rest contains:
- modifications to schema generated models and collections in be.api 
*/

var spaciblo = spaciblo || {}
spaciblo.api = spaciblo.api || {}
spaciblo.events = spaciblo.events || {}

spaciblo.api.handleSchemaPopulated = function(){
	/*
	Once the schema is loaded, we update the models and collections in be.api with custom logic.
	*/
	be.api.Template.prototype.geometryURL = function(){
		if(this.get('geometry')){
			return `${this.getBaseURL()}${this.get('geometry')}`
		}
		return null
	}
	be.api.Template.prototype.clientScriptURL = function(){
		if(this.get('clientScript')){
			return `${this.getBaseURL()}${this.get('clientScript')}`
		}
		return null
	}
	be.api.Template.prototype.simScriptURL = function(){
		if(this.get('simScript')){
			return `${this.getBaseURL()}${this.get('simScript')}`
		}
		return null
	}
	be.api.Template.prototype.getBaseURL = function(){
		return `/api/${be.API_VERSION}/template/${this.get('uuid')}/data/`
	}
	be.api.Template.prototype.getGeometryExtension = function(){
		const geometry = this.get('geometry')
		if(geometry == null || geometry == '' || geometry.indexOf('.') == -1){
			return null
		}
		return geometry.split('.')[geometry.split('.').length - 1].toLowerCase()
	}

	be.api.TemplateData.prototype.getDataURL = function(templateUUID){
		return `/api/${be.API_VERSION}/template/${templateUUID}/data/` + encodeURIComponent(this.get('name'))
	}

	be.api.TemplateData.prototype.getData = function(templateUUID){
		return new Promise((resolve, reject) => {
			const headers = new Headers()
			headers.set('Accept', be.schema.acceptFormat + be.API_VERSION)
			const fetchOptions = {
				method: 'get',
				headers: headers,
				credentials: 'same-origin' // So that cookies are sent and handled when received
			}
			fetch(this.getDataURL(templateUUID), fetchOptions).then(response => {
				if(response.status === 200){
					resolve(response.text())
					return
				}
				throw 'Failed with status: ' + response.status
			}).catch(err => {
				reject(err)
			})
		})
	}

	be.api.TemplateData.prototype.saveText = function(templateUUID, text){
		return new Promise((resolve, reject) => {
			const headers = new Headers()
			headers.set('Accept', be.schema.acceptFormat + be.API_VERSION)
			const fetchOptions = {
				body: text,
				method: 'put',
				headers: headers,
				credentials: 'same-origin' // So that cookies are sent and handled when received
			}
			fetch(this.getDataURL(templateUUID), fetchOptions).then(response => {
				if(response.status === 200){
					resolve()
					return
				}
				throw 'Failed with status: ' + response.status
			}).catch(err => {
				reject(err)
			})
		})
	}

	be.api.TemplateData.postFile = function(templateUUID, file){
		return new Promise((resolve, reject) => {
			const url = `/api/${be.API_VERSION}/template/${templateUUID}/data/`
			const data = new FormData()
			data.append('file', file)
			const headers = new Headers()
			headers.set('Accept', be.schema.acceptFormat + be.API_VERSION)
			const fetchOptions = {
				method: 'post',
				body: data,
				headers: headers,
				credentials: 'same-origin' // So that cookies are sent and handled when received
			}
			fetch(url, fetchOptions).then(response => {
				if(response.status === 200){
					return response.json()
				} else {
					console.error('Failed to post TemplateData', response)
					throw 'Failed with status: ' + response.status
				}
			}).then(data => {
				resolve(new be.api.TemplateData(data))
			}).catch(err => {
				reject(err)
			})
		})
	}

	be.api.Flock.prototype.getMembers = function(){
		if(typeof this._members !== 'undefined'){
			return this._members
		}
		this._members = new be.api.FlockMembers([], { 'flock-uuid': this.get('uuid') })
		this._members.fetch()
		return this._members
	}
	be.api.Flocks.prototype.getActiveFlock = function(){
		for(let flock of this){
			if(flock.get('active') === true) return flock
		}
		return null
	}
	be.api.FlockMember.prototype.getFloatArray = function(fieldName, defaultValue=null){
		return this.parseFloatArray(this.get(fieldName), defaultValue)
	}
	be.api.FlockMember.prototype.parseFloatArray = function(value, defaultValue=null){
		if(typeof value === 'undefined' || value === null || value === '') return defaultValue
		let tokens = value.split(',')
		let results = []
		for(let token of tokens){
			let val = parseFloat(token)
			if(Number.isNaN(val)){
				val = 0
			}
			results[results.length] = val
		}
		return results
	}
}

if(typeof document !== 'undefined'){
	// Running in a browser, so fire on document
	document.addEventListener('schema-populated', spaciblo.api.handleSchemaPopulated)	
} else if(typeof self !== 'undefined'){
	// Running in a web worker, so fire on self, which is the worker global scope
	self.addEventListener('schema-populated', spaciblo.api.handleSchemaPopulated)
}
