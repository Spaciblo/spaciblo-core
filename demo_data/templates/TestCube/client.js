// This is run in a web worker on each client, once for each template type
importScripts('/js/spaciblo-client.js')

MyWorker = class extends spaciblo.client.TemplateWorker {
	constructor(){
		super()
		this.isAnimatingMap = new Map() // group id -> bool
	}
	handleGroupAdded(data){
		console.log('added', data)
	}
	handleGroupClicked(data){
		console.log('group clicked', data)
		//this._runSpinCycle(data)
	}
	_runSpinCycle(data){
		if(this.isAnimatingMap.get(data.id) === true) return
		this.isAnimatingMap.set(data.id, true)

		const halfLife = 500
		const translationPerSecond = 0.8
		const positionChange = (halfLife / 1000) * translationPerSecond
		const rotationPerSecond = 12

		postMessage(new spaciblo.client.ChangePORTSMessage(data.id, {
			translation: [0, translationPerSecond, 0],
			rotation: [0, rotationPerSecond, 0]
		}))

		setTimeout(() => {
			postMessage(new spaciblo.client.ChangePORTSMessage(data.id, {
				position: [data.position[0], data.position[1] + positionChange, data.position[2]],
				translation: [0, -translationPerSecond, 0],
				rotation: [0, -rotationPerSecond, 0]
			}))
		}, halfLife)

		setTimeout(() => {
			postMessage(new spaciblo.client.ChangePORTSMessage(data.id, {
				position: data.position,
				orientation: [0,0,0,1],
				rotation: [0,0,0],
				translation: [0,0,0],
			}))
			this.isAnimatingMap.set(data.id, false)
		}, halfLife * 2)
	}
}
worker = new MyWorker()
