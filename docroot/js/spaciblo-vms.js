"use strict";
/*
Virtual Modifier System is a set of scene graph group selectors and modifiers
than can be applied to a Three.js scene graph
*/

var vms = vms || {};

vms.Marshalled = class {
	marshal(){
		let result = {}
		for(let key of Object.keys(this)){
			if(key.startsWith('_') === false) continue
			if(this[key] instanceof vms.Marshalled){
				result[key] = this[key].marshal()
			} else {
				result[key] = this[key]
			}
		}
		return result
	}
	unmarshal(data){
		for(let key of Object.keys(data)){
			if(data[key] != null && typeof data[key]._class === 'string'){
				this[key] = vms.unmarshal(data[key])
			} else {
				this[key] = data[key]
			}
		}
		return this
	}
}

vms.unmarshal = function(data){
	if(typeof data._class === 'string'){
		return new vms[data._class]().unmarshal(data)
	}
	return data
}

vms.Selector = class extends vms.Marshalled {
	constructor(){
		super()
		this._childOf = null
	}
	matches(group, objectMap){
		if(this._childOf === null) return true
		let parent = group.parent
		while(parent !== null){
			if(this._childOf.matches(parent, objectMap)) return true
			parent = parent.parent
		}
		return false
	}
	childOf(selector){
		this._childOf = selector
		return this
	}
}

vms.SelectProperty = class extends vms.Selector {
	constructor(name, value){
		super()
		this._class = 'SelectProperty'
		this._name = name
		this._value = value
	}
	matches(group, objectMap){
		if(group[this._name] !== this._value) return false
		return super.matches(group, objectMap)
	}
}
vms.selectProperty = function(name, value){ return new vms.SelectProperty(name, value) }

vms.SelectId = class extends vms.Selector {
	constructor(id){
		super()
		this._class = 'SelectId'
		this._id = id
	}
	matches(group, objectMap){
		if(!group.state) return false // We check state.id not group.id
		if(group.state.id !== this._id) return false
		return super.matches(group, objectMap)
	}
}
vms.selectId = function(id){ return new vms.SelectId(id) }

vms.Modifier = class extends vms.Marshalled {
	constructor(){
		super()
	}
}

vms.ModifyProperty = class extends vms.Modifier {
	constructor(path, value){
		super()
		this._class = 'ModifyProperty'
		this._path = path
		this._value = value
	}
	apply(group){
		let pathTokens = this._path.split('.')
		let obj = group
		for(let pathToken of pathTokens){
			if(typeof obj[pathToken] === 'undefined'){
				console.error('no such path', this._path, group)
				return
			}
			obj = obj[pathToken]
		}
		switch(typeof this._value){
			case 'object':
				for(let key of Object.keys(this._value)){
					obj[key] = this._value[key]
				}
				break
			default:
				console.error('unknown value type', typeof this._value, this._value)
		}
	}
}
vms.modifyProperty = function(path, value){ return new vms.ModifyProperty(path, value) } 


