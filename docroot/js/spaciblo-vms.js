"use strict";
/*
Virtual Modifier System is a set of scene graph group selectors and modifiers
than can be applied to a Three.js scene graph
*/

var vms = vms || {};

// A base class for Modifier and Selector that handles converting to and from a JSON.stringify-able data structure
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

/*
VMS uses descendents of Selector to find groups in the scene graph.
It then uses descendents of Modifier to modify the selected groups.
*/
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

/*
Select a group if it has a property of a certain value
*/
vms.SelectProperty = class extends vms.Selector {
	/*
	name: the attribute name of the group
	value: the value of attribute that must be matched (currently simple equivalency)
	*/
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

// Matches groups with a given id
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

// Once VMS selects groups to modify using a Selector, a descendent of Modifier (e.g. ModifyPropery) does the modifying
vms.Modifier = class extends vms.Marshalled {
	constructor(){
		super()
	}
}

/*
ModifyProperty is a VMS modifier that looks for a property on a selected group and modifies it to a passed value.
*/
vms.ModifyProperty = class extends vms.Modifier {
	/*
	path: a dot separated list of the property to change
	value: a simple type or object that will be assigned to the property found by path
	requiresCopy: if true, the matched group's material will be a copy of the material loaded with the template
	*/
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
		let lastToken = pathTokens[pathTokens.length - 1]
		let obj = group
		for(let i=0; i < pathTokens.length; i++){
			if(typeof obj[pathTokens[i]] === 'undefined'){
				console.error('no such path', this._path, group)
				return
			}
			if(i < pathTokens.length - 1){
				obj = obj[pathTokens[i]]
			}
		}
		switch(typeof this._value){
			case 'object':
				for(let key of Object.keys(this._value)){
					obj[lastToken][key] = this._value[key]
				}
				break
			case 'number':
			case 'boolean':
				obj[lastToken] = this._value
				break
			default:
				console.error('unknown value type', typeof this._value, this._value)
		}
	}
}
vms.modifyProperty = function(path, value, requiresCopy=false){ return new vms.ModifyProperty(path, value, requiresCopy) } 

/*
ModifyMaterialMap is a VMS modifier that updates a Material.map value.
*/
vms.ModifyMaterialMap = class extends vms.Modifier {
	/*
	value: an image path
	*/
	constructor(value, transparent=false, requiresCopy=false){
		super()
		this._class = 'ModifyMaterialMap'
		this._value = value
		this._transparent = transparent
		this._requiresCopy = requiresCopy
	}
	get requiresCopy(){ return this._requiresCopy }
	apply(group){
		let obj = group
		while(!obj.material && obj.children.length > 0){
			obj = obj.children[0]
		}
		if(!obj.material){
			console.error('ModifyMatertialMap failed to find a material', group)
			return
		}
		if(this.requiresCopy){
			vms.ensureCopy(obj)
		}
		obj.material.map = THREE.ImageUtils.loadTexture(this._value)
		obj.material.transparent = this._transparent
		obj.material.needsUpdate = true;
	}
}
vms.modifyMaterialMap = function(value, transparent=false, requiresCopy=false){ return new vms.ModifyMaterialMap(value, transparent, requiresCopy) } 

vms.ensureCopy = function(group){
	if(group.notACopy === true) return // Already split from the original
	group.notACopy = true
	if(group.material){
		group.material = group.material.clone()
		group.material.needsUpdate = true
	}
	// TODO when we have the ability to change the geometry we'll need to deep clone that, too
}

