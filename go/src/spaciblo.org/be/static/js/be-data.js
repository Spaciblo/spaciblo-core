"use strict";

/*
	EventListener holds information about listeners on an object with the eventMixin
*/
class EventListener {
	constructor(eventName, callback){
		this.eventName = eventName;
		this.callback = callback;
	}
	distributeEvent(eventName, ...params){
		if(this.eventName === "all" || eventName === this.eventName){
			this.callback(eventName, ...params);
		}
	}
}

/*
	Mix into your class to enable the instances to hold listeners and send them events
	Use it as a mixin like so: class YourObject extends eventMixin(YourObjectBase){}
*/
var eventMixin = Base => class extends Base {
	trigger(eventName, ...params){
		// Send an event to listeners
		for(let listener of this.listeners){
			listener.distributeEvent(eventName, ...params)
		}
	}
	addListener(eventName, callback){
		this.listeners.push(new EventListener(eventName, callback));
	}
	get listeners() {
		// Returns an array of EventListener instances
		if(typeof this._listeners == "undefined"){
			this._listeners = [];
		}
		return this._listeners;
	}
	clearListeners(){
		if(this._listeners){
			this._listeners.length = 0;
		}
	}
};

/*
	The parent class for DataModel and DataCollection
*/
class DataObjectBase {
	constructor(options={}){
		this.options = options;
	}
	cleanup(){
		this.clearListeners();
	}
	get url(){
		// Return the URL (relative or full) as a string for the endpoint used by this.fetch
		throw new Error("Extending classes must implement url()");
	}
	reset(data={}){
		// Clear out old data and set it to data
		throw new Error("Extending classes must implement reset");
	}
	parse(data){
		// Extending classes can override this to parse the data received via a fetch
		return data;
	}
	fetch(){
		// Ask the server for data for this model or collection
		return new Promise(function(resolve, reject){
			this.trigger("fetching", this);
			fetch(this.url).then(response => response.json()).then(data => {
				data = this.parse(data);
				this.reset(data);
				this.trigger("fetched", this, data, null);
				resolve();
			}).catch(err => {
				this.trigger("fetched", this, null, err);
				reject(err);
			});
		}.bind(this));
	}
}
class DataObject extends eventMixin(DataObjectBase){}

/*
	DataModel holds a map of key,value pairs, sometimes fetched from or sent to a back-end server.
	It fires events when values are changes.

	options:
		fieldModels ({}): a map of fieldName (string) to DataModel (class), used to create sub-models in this Model"s data
*/
class DataModel extends DataObject {
	constructor(data={}, options={}){
		super(options);
		if(typeof this.options.fieldModels === "undefined"){
			this.options.fieldModels = {};
		}
		this.data = data || {};
	}
	cleanup() {
		super.cleanup();
		this.data = null;
	}
	get(fieldName, defaultValue=null){
		if(typeof this.data[fieldName] === "undefined" || this.data[fieldName] === null || this.data[fieldName] === ""){
			return defaultValue
		}
		return this.data[fieldName];
	}
	setBatch(values){
		let changes = {};
		let changed = false;
		for(let key in values){
			let result = this._set(key, values[key]);
			if(result !== null){
				changed = true;
				changes[key] = result;
				this.trigger(`change:${key}`, this, key, result);
			}
		}
		if(changed){
			this.trigger("change", this, changes);
		}
		return changes;
	}
	set(fieldName, value){
		var batch = {};
		batch[fieldName] = value;
		return this.setBatch(batch);
	}
	_set(fieldName, data){
		if(this.options.fieldModels[fieldName]){
			if(this.data[fieldName]){
				this.data[fieldName].reset(data);
			} else {
				this.data[fieldName] = new this.options.fieldModels[fieldName](data);					
			}
		} else {
			if(this.data[fieldName] === data){
				return null;
			}
			this.data[fieldName] = data;
		}
		return this.data[fieldName];
	}
	reset(data={}){
		for(var key in this.data){
			if(typeof data[key] === "undefined"){
				data[key] = null;
			}
		}
		this.set(data);
	}
}

/*
	DataCollection represents an ordered list of DataModel instances

	options:
		dataModel (DataModel): the class to use to wrap each data item in this collection
*/
class DataCollection extends DataObject {
	constructor(dataModels=[], options={}){
		super(options);
		this.dataModels = [];
		for(let datum of dataModels){
			this.add(this.generateModel(datum));
		}
	}
	*[Symbol.iterator](){
		for(let datum of this.dataModels){
			yield datum;
		}
	}
	cleanup(){
		super.cleanup();
		this.dataModels.length = 0;
	}
	add(dataModel){
		if(this.dataModels.indexOf(dataModel) !== -1){
			return;
		}
		this.dataModels.push(dataModel);
		this.trigger("add", this, dataModel);
	}
	remove(dataModel){
		let index = this.dataModels.indexOf(dataModel);
		if(index === -1){
			return;
		}
		this.dataModels = this.dataModels.splice(index, 1);
		this.trigger("remove", this, dataModel);
	}
	reset(data){
		for(let model of this.dataModels.clone()){
			this.remove(model);
		}
		for(let data of data){
			this.add(this.generateModel(data));
		}
	}
	generateModel(data){
		let context = { collection: this };
		if(this.options.dataModel){
			return new this.options.dataModel(data, context);
		}
		return new DataModel(data, context);
	}
}
