import {Control} from 'ol/control'
class BackToCenter extends Control {
  constructor(settings) {
    const options = settings || {}
    const button = document.createElement('button')
    button.innerHTML = '◎'
    button.setAttribute('title', 'Reset view')
    const element = document.createElement('div')
    element.className = 'back-to-center ol-unselectable ol-control'
    element.style.cssText += 'top:6.25em;right:0.5em;'
    element.append(button)
    super({
      element: element,
      target: options.target
    })

    button.addEventListener('click', this.setCenter.bind(this), false)
    this.setOptions(options)
  }
  setOptions(options) {
    this.options = options
  }
  setCenter() {
    const view = this.getMap().getView()
    view.setCenter(this.options.center)
    view.setZoom(this.options.zoom)
  }
}

export { BackToCenter }
