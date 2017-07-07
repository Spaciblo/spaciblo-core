"use strict";

var spaciblo = spaciblo || {}
spaciblo.events = spaciblo.events || {}
spaciblo.components = spaciblo.components || {}

/*
AccountPageComponent wraps all of the logic for a/index.html
options:
	copyEl: a DOM element that contains the help copy
*/
spaciblo.components.HelpPageComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('help-page-component')

		this.topNav = new be.ui.TopNavComponent()
		this.el.appendChild(this.topNav.el)

		this.el.appendChild(this.options.copyEl)
	}
}