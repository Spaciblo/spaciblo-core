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

	// Show and hide the personal flock of things that are private to the local user
	'show-flock',
	'hide-flock',
	'toggle-flock',

	// The rest are high level locomotion actions
	'translate-forward',
	'translate-backward',
	'translate-left',
	'translate-right',
	'translate-up',
	'translate-down',
	'rotate-left',	// counter-clockwise rotation around the Y axis, equiv to rotate-y at -1.0
	'rotate-right', // clockwise rotation around the Y axis, equiv to rotate-y at 1.0
	'rotate-down',	// forward rotation around the X axis, equiv to rotate-x at -1.0
	'rotate-up',	// backward rotation around X axis, equiv to rotate-x at 1.0
	'roll-left',	// counter-clockwise roll around the Z axis, equiv to rotate-z at 1.0
	'roll-right',	// clockwise roll around the Z axis, equiv to rotate-z at -1.0
	'rotate-x',		// [-1,1] rotation around the X axis 
	'rotate-y',		// [-1,1] rotation around the Y axis
	'rotate-z'		// [-1,1] rotation around the Z axis
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
spaciblo.input.GEAR_VR_TOUCHPAD_ID_REGEX = /Gear VR Touchpad/
spaciblo.input.GEAR_VR_CONTROLLER_ID_REGEX = /Gear VR Controller/
spaciblo.input.OCULUS_REMOTE_ID_REGEX = /Oculus Remote/
spaciblo.input.WINDOWS_MIXED_REALITY_CONTROLLER = /Spatial Controller \(Spatial Interaction Source\) /
spaciblo.input.UNKNOWN_CONTROLLER_ID_REGEX = /unknown/

// All of the known controllers
spaciblo.input.CONTROLLER_ID_REGEXES = [
	spaciblo.input.XBOX_ONE_CONTROLLER_ID_REGEX,
	spaciblo.input.DAYDREAM_CONTROLLER_ID_REGEX,
	spaciblo.input.GEAR_VR_TOUCHPAD_ID_REGEX,
	spaciblo.input.GEAR_VR_CONTROLLER_ID_REGEX,
	spaciblo.input.OPENVR_CONTROLLER_ID_REGEX,
	spaciblo.input.OCULUS_TOUCH_CONTROLLER_ID_REGEX,
	spaciblo.input.WINDOWS_MIXED_REALITY_CONTROLLER,
	spaciblo.input.OCULUS_REMOTE_ID_REGEX
]

// In this schema, we treat the same all larger tracked controllers like Oculus Touch and OpenVR/Vive
spaciblo.input._defaultControllerInputs = [
	['left',	null, 0, null,	'left-point'],
	['right',	null, 0, null,	'right-point'],
	['left',	0, null, null,	'left-press'],
	['right', 	0, null, null,	'right-press'],
	['left',	1, null, null,	'left-trigger'],
	['right', 	1, null, null,	'right-trigger'],
	['left',	2, null, null,	'left-grip'],
	['right', 	2, null, null,	'right-grip'],
	['left',	3, null, null,	'toggle-flock'],
	['right', 	3, null, null,	'toggle-flock'],
	['left',	null, null, 0,	'left-glide-x'],
	['right', 	null, null, 0,	'right-glide-x'],
	['left',	null, null, 1,	'left-glide-y'],
	['right', 	null, null, 1,	'right-glide-y']
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

//	hand, button, touch, axis, action

// The Windows MR Controllers via the Steam bridge are a bit... different
spaciblo.input._windowsMixedRealityControllerInputs = [
	['left',	null, 4, null,	'left-point'],
	['right',	null, 4, null,	'right-point'],
	['left',	4, null, null,	'left-press'],
	['right', 	4, null, null,	'right-press'],
	['left',	1, null, null,	'left-trigger'],
	['right', 	1, null, null,	'right-trigger'],
	['left',	2, null, null,	'left-grip'],
	['right', 	2, null, null,	'right-grip'],
	['left',	3, null, null,	'toggle-flock'],
	['right', 	3, null, null,	'toggle-flock'],
	['left',	null, null, 2,	'left-glide-x'],
	['right', 	null, null, 2,	'right-glide-x'],
	['left',	null, null, 3,	'left-glide-y'],
	['right', 	null, null, 3,	'right-glide-y']
]
for(let input of spaciblo.input._windowsMixedRealityControllerInputs){
	spaciblo.input._generateGamepadInput(spaciblo.input.DefaultInputSchema, spaciblo.input.WINDOWS_MIXED_REALITY_CONTROLLER, input)
}

// This is the layout for smaller controllers with handedness like the Daydream 3dof controller and the Gear VR controller
spaciblo.input._smallerControllerInputs = [
	['left',	null, 0, null,	'left-point'],
	['right',	null, 0, null,	'right-point'],
	['left',	0, null, null,	'left-press'],
	['right', 	0, null, null,	'right-press'],
	['left',	1, null, null,	'left-trigger'], // Daydream and GearVR Touchpad do not have button 1, but Gear VR Controller does
	['right', 	1, null, null,	'right-trigger'],
	['left',	null, null, 0,	'left-glide-x'],
	['right', 	null, null, 0,	'right-glide-x'],
	['left',	null, null, 1,	'left-glide-y'],
	['right', 	null, null, 1,	'right-glide-y']
]
for(let input of spaciblo.input._smallerControllerInputs){
	spaciblo.input._generateGamepadInput(spaciblo.input.DefaultInputSchema, spaciblo.input.DAYDREAM_CONTROLLER_ID_REGEX, input)
}
for(let input of spaciblo.input._smallerControllerInputs){
	spaciblo.input._generateGamepadInput(spaciblo.input.DefaultInputSchema, spaciblo.input.GEAR_VR_CONTROLLER_ID_REGEX, input)
}

// This is the layout for the GearVR touchpad, which has no handedness
spaciblo.input._touchpadControllerInputs = [
	[null, null, 0, null,	'point'],
	[null, 0, null, null,	'press'],
	[null, null, null, 0,	'glide-x'],
	[null, null, null, 1,	'glide-y'],
]
for(let input of spaciblo.input._touchpadControllerInputs){
	spaciblo.input._generateGamepadInput(spaciblo.input.DefaultInputSchema, spaciblo.input.GEAR_VR_TOUCHPAD_ID_REGEX, input)
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
	[219, 'point'],		// [
	[80, 'press'],		// p
	[84, 'trigger'],	// t

	[38, 'translate-forward'], // ArrowUp
	[87, 'translate-forward'], // w

	[40, 'translate-backward'], // ArrowDown
	[83, 'translate-backward'], // s

	[69, 'translate-left'],		// e
	[81, 'translate-right'],	// q

	[82, 'translate-up'],	// r
	[70, 'translate-down'],	// f

	[37, 'rotate-left'],	// ArrowLeft
	[65, 'rotate-left'],	// a

	[39, 'rotate-right'],	// ArrowRight
	[68, 'rotate-right'],	// d

	[88, 'rotate-down'],	// 88
	[90, 'rotate-up'],		// 90

	[67, 'roll-left'],	// c
	[86, 'roll-right'],	// v

	[61, 'glide-y', 0.1],	// =
	[173, 'glide-y', -0.1],	// - 

	[48, 'hide-flock'], // 0
	[49, 'show-flock']  // 1
]
// Load the keyboard inputs into the DefaultInputSchema
spaciblo.input._defaultKeyCodeActions.forEach((code, index) => {
	code[1] = spaciblo.input.DefaultInputSchema.getAction(code[1])
	spaciblo.input.DefaultInputSchema.addKeyCodeAction(...code)
})
