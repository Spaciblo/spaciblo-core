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
		this._childDepth = 20 // how many generations of the child's parents should we consider when checking childOf? 
	}
	matches(group, objectMap){
		if(this._childOf === null) return true
		let depth = 1
		let parent = group.parent
		while(parent !== null){
			if(this._childOf.matches(parent, objectMap)) return true
			if(depth >= this._childDepth) break
			parent = parent.parent
			depth += 1
		}
		return false
	}
	childOf(selector, childDepth=20){
		this._childOf = selector
		this._childDepth = childDepth
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

/*
parameters:
	path: a dot separated list of the property to change
	value: a simple type or object that will be assigned to the property found by path
	requiresCopy: if true, the matched group's material will be a copy of the material loaded with the template
*/
vms.ModifyProperty = class extends vms.Modifier {
	constructor(path, value, requiresCopy=false){
		super()
		this._class = 'ModifyProperty'
		this._path = path
		this._value = value
		this._requiresCopy = requiresCopy
	}
	get requiresCopy(){ return this._requiresCopy }
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
vms.modifyProperty = function(path, value, requiresCopy=false){ return new vms.ModifyProperty(path, value, requiresCopy) } 


