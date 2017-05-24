'use strict'

/*
The default input mapping for gamepads/controllers and keyboards to high level actions.

Look in spaciblo-input.js for the code that does the runtime detection of input events and mapping to actions.
*/

var spaciblo = spaciblo || {}
spaciblo.input = spaciblo.input || {}

// The InputManager will use this schema when mapping inputs to actions
spaciblo.input.DefaultInputSchema = new spaciblo.input.InputSchema()

// These are the high level actions to which raw inputs like button presses will be mapped
spaciblo.input._defaultActions = [
	'point',	// point with a controller or with a gaze cursor
	'left-point',
	'right-point',
	'press',	// a primary 'go' action, e.g. point at something and then 'press' to activate
	'left-press',
	'right-press',
	'trigger',	// a secondary 'go' action
	'left-trigger',
	'right-trigger',
	'grip',		// a tertiary 'go' action
	'left-grip',
	'right-grip',
	'glide-x',	// a horizontal axis movement
	'left-glide-x',
	'right-glide-x',
	'glide-y',	// a vertical axis movement
	'left-glide-y',
	'right-glide-y',
	'back',		// an indication that a previous action should be undone
	'left-back',
	'right-back',
	// The rest are high level locomotion actions
	'translate-forward',
	'translate-backward',
	'translate-left',
	'translate-right',
	'translate-up',
	'translate-down',
	'rotate-left',	// counter-clockwise rotation around the Y axis, equiv to rotate-y at -1.0
	'rotate-right', // clockwise rotation around the Y axis, equiv to rotate-y at 1.0
	'rotate-x',		// [-1,1] rotation around the X axis 
	'rotate-y',		// [-1,1] rotation around the Y axis
	'rotate-z',		// [-1,1] rotation around the Z axis
]
// Load the actions into the DefaultInputSchema
spaciblo.input._defaultActions.forEach((name, index) => {
	spaciblo.input.DefaultInputSchema.addAction(new spaciblo.input.InputAction(name))
})

// These regular expressions are used to recognize specific gamepad ids
spaciblo.input.XBOX_ONE_CONTROLLER_ID_REGEX = /xinput/
spaciblo.input.DAYDREAM_CONTROLLER_ID_REGEX = /Daydream Controller/
spaciblo.input.OPENVR_CONTROLLER_ID_REGEX = /OpenVR Gamepad/
spaciblo.input.OCULUS_TOUCH_CONTROLLER_ID_REGEX = /Oculus Touch \((Left|Right)\)/
spaciblo.input.OCULUS_REMOTE_ID_REGEX = /Oculus Remote/
spaciblo.input.UNKNOWN_CONTROLLER_ID_REGEX = /unknown/

// All of the known controllers
spaciblo.input.CONTROLLER_ID_REGEXES = [
	spaciblo.input.XBOX_ONE_CONTROLLER_ID_REGEX,
	spaciblo.input.DAYDREAM_CONTROLLER_ID_REGEX,
	spaciblo.input.OPENVR_CONTROLLER_ID_REGEX,
	spaciblo.input.OCULUS_TOUCH_CONTROLLER_ID_REGEX,
	spaciblo.input.OCULUS_REMOTE_ID_REGEX
]

// In this schema, we treat the same all known tracked controllers like Oculus Touch and OpenVR/Vive
spaciblo.input._defaultControllerInputs = [
	['left',	null, 0, null,	'left-point'],
	['right',	null, 0, null,	'right-point'],
	['left',	0, null, null,	'left-press'],
	['right', 	0, null, null,	'right-press'],
	['left',	1, null, null,	'left-trigger'],
	['right', 	1, null, null,	'right-trigger'],
	['left',	2, null, null,	'left-grip'],
	['right', 	2, null, null,	'right-grip'],
	['left',	null, null, 0,	'left-glide-x'],
	['right', 	null, null, 0,	'right-glide-x'],
	['left',	null, null, 1,	'left-glide-y'],
	['right', 	null, null, 1,	'right-glide-y'],
]
// Load the inputs for each tracked controller type that we treat the same
spaciblo.input._generateGamepadInput = function(schema, idRegex, input){
	schema.addControllerInput(new spaciblo.input.ControllerInput(
		idRegex, input[0], input[1], input[2], input[3], schema.getAction(input[4])
	))
}
for(let input of spaciblo.input._defaultControllerInputs){
	spaciblo.input._generateGamepadInput(spaciblo.input.DefaultInputSchema, spaciblo.input.OCULUS_TOUCH_CONTROLLER_ID_REGEX, input)
}
for(let input of spaciblo.input._defaultControllerInputs){
	spaciblo.input._generateGamepadInput(spaciblo.input.DefaultInputSchema, spaciblo.input.OPENVR_CONTROLLER_ID_REGEX, input)
}

// This is the layout for smaller controllers like the Daydream 3dof controller and the GearVR controller
spaciblo.input._smallerControllerInputs = [
	['left',	null, 0, null,	'left-point'],
	['right',	null, 0, null,	'right-point'],
	['left',	0, null, null,	'left-press'],
	['right', 	0, null, null,	'right-press'],
	['left',	null, null, 0,	'left-glide-x'],
	['right', 	null, null, 0,	'right-glide-x'],
	['left',	null, null, 1,	'left-glide-y'],
	['right', 	null, null, 1,	'right-glide-y']
]
for(let input of spaciblo.input._smallerControllerInputs){
	spaciblo.input._generateGamepadInput(spaciblo.input.DefaultInputSchema, spaciblo.input.DAYDREAM_CONTROLLER_ID_REGEX, input)
}

// For gamepad IDs that we don't recognize and for XBox controllers, this is a standard gamepad layout
spaciblo.input._genericGamepadInputs = [
	['',	4, null, null,	'point'],
	['',	10, null, null,	'press'],
	['',	6, null, null,	'trigger'],
	['',	7, null, null,	'grip'],
	['',	null, null, 0,	'glide-x'],
	['',	null, null, 1,	'glide-y']
]
for(let input of spaciblo.input._genericGamepadInputs){
	spaciblo.input._generateGamepadInput(spaciblo.input.DefaultInputSchema, spaciblo.input.XBOX_ONE_CONTROLLER_ID_REGEX, input)
}
for(let input of spaciblo.input._genericGamepadInputs){
	spaciblo.input._generateGamepadInput(spaciblo.input.DefaultInputSchema, spaciblo.input.UNKNOWN_CONTROLLER_ID_REGEX, input)
}

// Keyboard inputs in the form [keyCode, action name]
spaciblo.input._defaultKeyCodeActions = [
	[219, 'point'],
	[80, 'press'],

	[38, 'translate-forward'],
	[87, 'translate-forward'],

	[40, 'translate-backward'],
	[83, 'translate-backward'],

	[69, 'translate-left'],
	[81, 'translate-right'],

	[82, 'translate-up'],
	[70, 'translate-down'],

	[65, 'rotate-left'],
	[37, 'rotate-left'],

	[39, 'rotate-right'],
	[68, 'rotate-right']
]
// Load the keyboard inputs into the DefaultInputSchema
spaciblo.input._defaultKeyCodeActions.forEach((code, index) => {
	code[1] = spaciblo.input.DefaultInputSchema.getAction(code[1])
	spaciblo.input.DefaultInputSchema.addKeyCodeAction(...code)
})
