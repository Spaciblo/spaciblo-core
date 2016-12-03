"use strict"

var be = be || {}
be.api = be.api || {}
be.schema = be.schema || {}
be.events = be.events || {}

be.events.registerDOMEvent = function(eventName, humanReadableName=eventName){
	var event = new CustomEvent(humanReadableName)
	event.initEvent(eventName, true, true)
	return event
}

// Triggered on the document when the API schema is populated and has created base models and collections
be.events.SchemaPopulated = 'schema-populated'
be.events.SchemaPopulatedEvent = be.events.registerDOMEvent(be.events.SchemaPopulated)

// Used by the authentication mechanism
be.api.sessionCookie = "be_auth"
be.api.emailCookie = "be_email"

// Send a be.events.SchemaPopulated event when pages can depend on the scheme to be loaded
// For the moment, just trigger it on DOMContentLoaded
document.addEventListener("DOMContentLoaded", function(){
	document.dispatchEvent(be.events.SchemaPopulatedEvent)
})

