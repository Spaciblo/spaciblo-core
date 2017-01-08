'use strict'

var be = be || {}
be.ui = be.ui || {}
be.events = be.events || {}

be.events.LoginSuccessful = 'be-login-successful'

/*
Generate a form for use in a bootstrap style form.
Pass an inputType of "static" if it should just be a display field.
*/
be.ui.generateInputFormGroup = function(inputType, name, id, label, placeholder){
	var formGroup = k.el.div({'class':'form-group input-form-group'})
	if(label){
		formGroup.appendChild(k.el.label({
			'for':name,
			'class':'control-label'
		}, label))
	}
	if(inputType == 'static'){
		var input = k.el.span({
			'id':id,
			'class':'form-control-static'
		})
	} else if(inputType == 'textarea'){
		var input = k.el.textarea({
			'id':id,
			'class':'form-control',
			'placeholder':placeholder
		})
	} else {
		var input = k.el.input({
			'id':id,
			'type':inputType,
			'class':'form-control',
			'placeholder':placeholder
		})
	}
	formGroup.appendChild(k.el.div({'class':'input-wrapper'}, input))
	return formGroup
}

/*
TopNavComponent renders the top navigation links as well as login/out links.
*/
be.ui.TopNavComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('top-nav-component')
		this.nav = k.el.nav().appendTo(this.el)
		this.siteName = k.el.a(
			{ href: '/' },
			k.el.h1('Spaciblō')
		).appendTo(this.nav)

		this.rightLinks = k.el.ul(
			{ class: 'right-links'},
			k.el.li(k.el.a({ href: '/a/' }, 'account'))
		).appendTo(this.nav)
	}
}

/*
LoginComponent renders the email and password form to allow the user to authenticate
*/
be.ui.LoginComponent = class extends k.Component {
	constructor(dataObject=null, options={}){
		super(dataObject, options)
		this.el.addClass('login-component')

		this.errorMessage = k.el.div({ class: 'error' }).appendTo(this.el)
		this.errorMessage.style.display = 'none'

		this.emailFormGroup = be.ui.generateInputFormGroup(
			'text',
			'email', 'email',
			'Email', 'Email'
		)

		this.passwordFormGroup = be.ui.generateInputFormGroup(
			'password',
			'password', 'password',
			'Password', 'Password'
		)

		this.submitButton = k.el.button({
			'type':'submit'
		}, 'Login')
		this.submitGroup = k.el.div(
			{ class: 'form-group submit-group' },
			this.submitButton
		)

		this.form = k.el.form(
			{ class: 'form' },
			this.emailFormGroup,
			this.passwordFormGroup,
			this.submitGroup
		).appendTo(this.el)
		this.form.addEventListener('submit', this.handleSubmit.bind(this))
	}
	handleSubmit(ev){
		ev.preventDefault()
		let email = this.emailFormGroup.querySelector('input').value
		let password = this.passwordFormGroup.querySelector('input').value
		if(email === '' || password === ''){
			this.showError('Please enter an email and password.')
			return
		}
		this.hideError()
		this.clearInput()
		be.api.login(email, password).then(([status, data]) => {
			this.handleLoginSuccess(status, data)
		}).catch((...params) => {
			this.handleLoginFailure(...params)
		})
	}
	clearInput(){
		this.emailFormGroup.querySelector('input').value = ''
		this.passwordFormGroup.querySelector('input').value = ''
	}
	hideError(){
		this.errorMessage.style.display = 'none'
	}
	showError(message){
		this.errorMessage.innerText = message
		this.errorMessage.style.display = 'block'
	}
	handleLoginSuccess(status, data){
		if(status === 200){
			this.trigger(be.events.LoginSuccessful)
		} else {
			this.showError('Could not log in with that email and password')
		}
	}
	handleLoginFailure(...params){
		console.error('Error', ...params)
	}
}