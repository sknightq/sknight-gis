import { Control } from 'ol/control'
// Add a custom control for ol.map， which can allow user reseting the view.
class BackToCenter extends Control {
  constructor(settings) {
    const options = settings || {}
    const $button = document.createElement('button')
    $button.innerHTML = '◎'
    $button.setAttribute('title', 'Reset view')
    const $element = document.createElement('div')
    $element.className = 'back-to-center ol-unselectable ol-control'
    $element.style.cssText += 'top:5.75rem;right:0.5rem;'
    $element.append($button)
    super({
      element: $element,
      target: options.target
    })

    $button.addEventListener('click', this.setCenter.bind(this), false)
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

class SwitchTiles extends Control {
  constructor(settings) {
    const options = settings || {}

    const $ul = document.createElement('ul')
    options.tiles.forEach((tile, idx) => {
      const $li = document.createElement('li')
      let $radio = ''
      if (idx === 0) {
        $radio = `<input id="tile-${tile.key}" value="${tile.key}" type="radio" name="tile" checked/>`
      } else {
        $radio = `<input id="tile-${tile.key}" value="${tile.key}" type="radio" name="tile"/>`
      }
      $li.innerHTML = `<label for="tile-${tile.key}">${tile.name}</label>` + $radio

      $ul.appendChild($li)
    })
    const $element = document.createElement('div')
    $element.className = 'switch-tiles ol-unselectable ol-control'
    $element.style.cssText += 'top:0.5rem;right:2.5rem;'
    $element.append($ul)
    super({
      element: $element,
      target: options.target
    })
    this.selectedIdx = 0
    $ul.querySelectorAll('li').forEach($li => {
      $li.addEventListener(
        'click',
        e => {
          this.switchTile(e.target.parentElement.querySelector('input').value)
        },
        false
      )
    })
    this.setOptions(options)
  }
  setOptions(options) {
    this.options = options
  }
  switchTile(tileKey) {
    const map = this.getMap()
    const oldTile = this.options.tiles[this.selectedIdx]

    const oldTileLayer = oldTile.tileLayer && map.getLayer(oldTile.tileLayer.name)
    const oldLabelLayer = oldTile.labelLayer && map.getLayer(oldTile.labelLayer.name)

    this.options.tiles.forEach((tile, idx) => {
      if (tile.key === tileKey) {
        this.selectedIdx = idx
      }
    })
    const newTile = this.options.tiles[this.selectedIdx]
    const methods = {
      wgs: 'addWGSTileLayer',
      gcj: 'addGCJTileLayer',
      baidu: 'addBDTileLayer'
    }
    const method = map[methods[newTile.type]]
    if (newTile.tileLayer && typeof method === 'function') {
      const newLayer = method(newTile.tileLayer.name, newTile.tileLayer.url, null)
      map.addLayer(newLayer)
      if (oldTileLayer) {
        const zIndex = oldTileLayer.getZIndex()
        newLayer.setZIndex(zIndex)
        map.removeLayer(oldTileLayer)
      }
    }

    if (newTile.labelLayer && typeof method === 'function') {
      const newLayer = method(newTile.labelLayer.name, newTile.labelLayer.url, null)
      map.addLayer(newLayer)
      if (oldLabelLayer) {
        const zIndex = oldLabelLayer.getZIndex()
        newLayer.setZIndex(zIndex)
        map.removeLayer(oldLabelLayer)
      } else {
        newLayer.setZIndex(oldTileLayer.getZIndex() + 1)
      }
    } else {
      map.removeLayer(oldLabelLayer)
    }
  }
}

export { BackToCenter, SwitchTiles }
