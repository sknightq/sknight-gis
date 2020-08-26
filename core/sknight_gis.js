import 'ol/ol.css'
import { Map, View, Feature, Overlay } from 'ol'
import GeoJSON from 'ol/format/GeoJSON'
import { defaults as defaultControls, FullScreen, OverviewMap } from 'ol/control'
import { transform, transformExtent, addProjection, addCoordinateTransforms } from 'ol/proj'
import Projection from 'ol/proj/Projection'
import TileGrid from 'ol/tilegrid/TileGrid'
import { boundingExtent, applyTransform } from 'ol/extent'
import { Tile as TileLayer, Vector as VectorLayer, Image as ImageLayer, Heatmap as HeatmapLayer } from 'ol/layer'
import ImageCanvasSource from 'ol/source/ImageCanvas'
import * as geom from 'ol/geom'
import { Stroke, Style, Fill, Circle, Text, Icon } from 'ol/style'
import { XYZ, Vector as VectorSource } from 'ol/source'
import { BackToCenter, SwitchTiles } from '@/assets/scripts/olControl.js'
// import { dealCoord } from '@/assets/scripts/dealCoord.js'
import projzh from 'projzh'
const extend = require('extend')

class OlMap {
  DEAFAULT_PROJ = 'EPSG:3857'
  DATA_PROJ = 'EPSG:4326'

  defaults = {
    target: document.getElementById('map'),
    layers: {
      crossOrigin: null,
      baseMap: [
        {
          tileLayer: {
            url: 'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
            name: 'basic-tile'
          },
          name: '基础底图',
          key: 'basic',
          type: 'wgs'
        }
      ]
    },
    view: {
      center: [-472202, 7530279],
      rotation: Math.PI / 6,
      zoom: 12
    },
    controls: {
      backCenter: {
        enable: false
      },
      fullScreen: {
        enable: false
      },
      overviewMap: {
        enable: false
      },
      switchTiles: {
        enable: false
      }
    },
    tools: {
      popup: {
        enable: false, // 弹出框
        refs: null
      }
    },
    extent: {
      bound: []
    }
  }

  zIndex = {
    baseTileLayer: 50, // 瓦片底图
    baseLableLayer: 60, // 标注底图
    overlay: 100, // 普通层
    boundary: 150, // 边界
    heat: 300, // 热力图
    contour: 405,
    topo: 410,
    draw: 450,
    station: 500, // 站点
    stationName: 501,
    stationValue: 502,
    popup: 750, // 弹框
    control: 1000 // 控件
  }
  status = {
    popupable: []
  }
  // feature 默认样式
  featureStyle = {
    image: {
      opacity: '1',
      scale: 0.6,
      size: [100, 100],
      radius: 5,
      offset: [-50, -50],
      fillColor: 'rgba(3,3,3, 1)',
      strokeColor: 'rgba(255, 255, 255, 1)',
      strokeWidth: 1
    },
    text: {
      font: '12px 微软雅黑',
      fillColor: 'rgba(0, 21, 41, 1)',
      strokeColor: 'rgba(255, 255, 255, 1)',
      strokeWidth: 1
    },
    geometry: {
      fillColor: 'rgba(0,0,0, 0.6)',
      strokeColor: 'rgba(0,0,0, 0.6)',
      strokeWidth: 1
    }
  }

  view = function(options, extent) {
    return new View({
      center: transform(options.center, this.DATA_PROJ, this.DEAFAULT_PROJ),
      constrainResolution: true,
      zoom: options.zoom,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      extent: extent
    })
  }
  layers = function(options) {
    const layers = []
    // 底图
    if (options.baseMap.length) {
      const baseMap = options.baseMap[0]
      const methods = {
        wgs: 'addWGSTileLayer',
        gcj: 'addGCJTileLayer',
        baidu: 'addBDTileLayer'
      }
      const method = this[methods[baseMap.type]]
      if (baseMap.tileLayer && typeof method === 'function') {
        const baseTileLayer = method(baseMap.tileLayer.name, baseMap.tileLayer.url, options.crossOrigin)
        baseTileLayer.setZIndex(this.zIndex['baseTileLayer'])
        layers.push(baseTileLayer)
      }
      if (baseMap.labelLayer && typeof method === 'function') {
        const baseLabelLayer = method(baseMap.labelLayer.name, baseMap.labelLayer.url, options.crossOrigin)
        baseLabelLayer.setZIndex(this.zIndex['baseLabelLayer'])
        layers.push(baseLabelLayer)
      }
    }

    // 行政边界
    if (options.boundary.enable) {
      for (let i = 0; i < options.boundary.items.length; i++) {
        const boundary = options.boundary.items[i]
        const boundaryLayer = new VectorLayer({
          name: boundary.name,
          source: new VectorSource({
            url: boundary.url,
            format: new GeoJSON({
              defaultDataProjection: this.DATA_PROJ,
              projection: this.DEAFAULT_PROJ
            })
          }),
          style: new Style({
            stroke: new Stroke({
              color: boundary.color ? boundary.color : 'rgba(43, 140, 218, 0.9)',
              width: boundary.width ? boundary.width : 1
            }),
            fill: new Fill({
              color: boundary.fillColor ? boundary.fillColor : 'rgba(0, 0, 0, 0)'
            })
          })
        })

        boundaryLayer.setZIndex(this.zIndex['boundary'] + i)
        layers.push(boundaryLayer)
      }
    }
    return layers
  }
  controls = function(options, viewOptions, layersOptions) {
    const controlExtends = []
    const defaultOptions = {
      attributionOptions: /** @type {olx.control.AttributionOptions} */ ({
        collapsible: false
      })
    }
    // 开启全屏功能
    if (options.fullScreen.enable) {
      controlExtends.push(new FullScreen())
    }

    // 开启鹰眼功能
    if (options.overviewMap.enable) {
      controlExtends.push(new OverviewMap())
    }

    // 回到中心点
    if (options.backCenter.enable) {
      controlExtends.push(
        new BackToCenter({
          center: transform(viewOptions.center, this.DATA_PROJ, this.DEAFAULT_PROJ),
          zoom: viewOptions.zoom
        })
      )
    }
    // 切换底图
    if (options.switchTiles.enable) {
      controlExtends.push(
        new SwitchTiles({
          tiles: layersOptions.baseMap
        })
      )
    }

    return defaultControls(defaultOptions).extend(controlExtends)
  }

  constructor(settings) {
    this.options = extend(true, {}, this.defaults, settings)
    this.$element = this.options.target
    const extent = boundingExtent(this.options.extent.bound)

    if (Array.isArray(extent) && this.options.extent.bound.length > 1) {
      this.options.extent = transformExtent(extent, this.DATA_PROJ, this.DEAFAULT_PROJ)
    } else {
      this.options.extent = undefined
    }

    this.map = new Map({
      target: this.options.target,
      layers: this.layers(this.options.layers),
      view: this.view(this.options.view, this.options.extent),
      controls: this.controls(this.options.controls, this.options.view, this.options.layers)
    })

    this.getZIndex = function(name) {
      return this.zIndex[name] ? this.zIndex[name] : 500
    }

    this.setStatus = function(statusName, statusValue) {
      if (this.status[statusName] instanceof Array) {
        this.status[statusName].push(statusValue)
      } else {
        this.status[statusName] = statusValue
      }
    }

    this.getStatus = function(statusName) {
      return this.status[statusName]
    }

    this.getTextStyle = function(name) {
      return this.featureStyle.text[name]
    }

    this.getImageStyle = function(name) {
      return this.featureStyle.image[name]
    }

    this.getGeometryStyle = function(name) {
      return this.featureStyle.geometry[name]
    }
  }
}
/**
 * @name  tools
 * @returns {void}
 * @description 地图tools初始增加额外的工具
 */
OlMap.prototype.tools = function() {
  const options = this.options
  this.map.on('singleclick', e => {
    console.log(transform(e.coordinate, this.DEAFAULT_PROJ, this.DATA_PROJ))
  })

  if (options.tools.popup.enable) {
    // 用组建去获取
    const container = options.tools.popup.refs
    const content = options.tools.popup.refs.querySelector('#popup-content')
    const closer = options.tools.popup.refs.querySelector('#popup-closer')

    const overlay = new Overlay({
      id: 'popup',
      offset: options.tools.popup.offset,
      element: container,
      autoPan: true, // 弹窗全部显示在地图中
      positioning: 'center-center',
      autoPanAnimation: {
        duration: 250
      }
    })

    // 增加popup的overlay层
    this.map.addOverlay(overlay)

    this.map.on('singleclick', e => {
      const feature = this.map.forEachFeatureAtPixel(e.pixel, feature => feature)
      if (feature) {
        let layerName = ''
        const hit = this.map.forEachFeatureAtPixel(e.pixel, (feature, layer) => {
          if (layer && this.getStatus('popupable').includes(layer.get('name'))) {
            layerName = layer.get('name')
            return true
          } else {
            overlay.setPosition(undefined)
            closer.blur()
            return false
          }
        })

        if (hit) {
          const coordinates = feature.getProperties().center
          const stationInfo = feature.get('data') ? feature.get('data') : ''
          const event = document.createEvent('HTMLEvents')
          // 初始化
          event.initEvent('stationclick', false, false)
          // 弹窗里的参数
          event.params = {
            data: stationInfo,
            overlay,
            container: content,
            layerName,
            coordinates
          }
          // 触发, 即弹出文字
          this.$element.dispatchEvent(event)
          return true
        } else {
          const event = document.createEvent('HTMLEvents')
          // 初始化
          event.initEvent('emptyclick', false, false)
          event.params = {
            data: null,
            overlay
          }
          this.$element.dispatchEvent(event)
          return true
        }
      } else {
        overlay.setPosition(undefined)
        closer.blur()
        return false
      }
    })
  }
}
OlMap.prototype.addWGSTileLayer = function(name, url, crossOrigin) {
  return new TileLayer({
    name,
    source: new XYZ({
      url,
      crossOrigin,
      tileLoadFunction: function(tile, src) {
        tile.getImage().src = src
      }
    })
  })
}
OlMap.prototype.addGCJTileLayer = function(name, url, crossOrigin) {
  const mc2gcj02mc = function(input, optOutput, optDimension) {
    var output = projzh.projection.sphericalMercator.inverse(input, optOutput, optDimension)
    output = projzh.datum.gcj02.fromWGS84(output, output, optDimension)
    return projzh.projection.sphericalMercator.forward(output, output, optDimension)
  }

  const gcj02mc2mc = function(input, optOutput, optDimension) {
    var output = projzh.projection.sphericalMercator.inverse(input, optOutput, optDimension)
    output = projzh.datum.gcj02.toWGS84(output, output, optDimension)
    return projzh.projection.sphericalMercator.forward(output, output, optDimension)
  }

  const gcj02mc2ll = function(input, optOutput, optDimension) {
    var output = projzh.projection.sphericalMercator.inverse(input, optOutput, optDimension)
    return projzh.datum.gcj02.toWGS84(output, output, optDimension)
  }

  const ll2gcj02mc = function(input, optOutput, optDimension) {
    var output = projzh.datum.gcj02.fromWGS84(input, optOutput, optDimension)
    return projzh.projection.sphericalMercator.forward(output, output, optDimension)
  }

  const gcj02mc = new Projection({
    code: 'GCJ02MC',
    extent: applyTransform([-180, -90, 180, 90], ll2gcj02mc),
    units: 'm'
  })

  addProjection(gcj02mc)
  addCoordinateTransforms('EPSG:4326', gcj02mc, ll2gcj02mc, gcj02mc2ll)
  addCoordinateTransforms('EPSG:3857', gcj02mc, mc2gcj02mc, gcj02mc2mc)

  let resolutions = []
  for (let i = 0; i < 19; i++) {
    resolutions[i] = Math.pow(2, 18 - i) * 0.5971642833948135
  }
  return new TileLayer({
    name,
    source: new XYZ({
      projection: gcj02mc,
      url,
      crossOrigin,
      tileGrid: new TileGrid({
        origin: [-20037508.342789244, 20037508.34278071],
        minZoom: 3,
        tileSize: [256, 256],
        extent: transformExtent([-180, -90, 180, 90], 'EPSG:4326', 'GCJ02MC'),
        resolutions: resolutions
      })
    })
  })
}

OlMap.prototype.addBDTileLayer = function(name, url, crossOrigin) {
  const extent = [-20037726.37, -12474104.17, 20037726.37, 12474104.17]

  const baiduMercator = new Projection({
    code: 'baidu',
    extent: extent,
    units: 'm'
  })

  addProjection(baiduMercator)
  addCoordinateTransforms('EPSG:4326', baiduMercator, projzh.ll2bmerc, projzh.bmerc2ll)
  addCoordinateTransforms('EPSG:3857', baiduMercator, projzh.smerc2bmerc, projzh.bmerc2smerc)

  const bmercResolutions = new Array(19)
  for (let i = 0; i < 19; ++i) {
    bmercResolutions[i] = Math.pow(2, 18 - i)
  }

  const urls = [0, 1, 2, 3].map(function(sub) {
    return 'http://maponline' + sub + '.bdimg.com/tile/?qt=vtile&x={x}&y={y}&z={z}&styles=pl&scaler=2&udt=20191119'
  })

  const tileLayer = new TileLayer({
    name,
    source: new XYZ({
      projection: 'baidu',
      url,
      crossOrigin,
      tileGrid: new TileGrid({
        resolutions: bmercResolutions,
        origin: [0, 0],
        extent: extent,
        tileSize: [256, 256]
      }),
      tilePixelRatio: 2,
      tileUrlFunction: function(tileCoord) {
        let x = tileCoord[1]
        let y = -tileCoord[2] - 1
        const z = tileCoord[0]
        const hash = (x << z) + y
        let index = hash % urls.length
        index = index < 0 ? index + urls.length : index
        if (x < 0) {
          x = 'M' + -x
        }
        if (y < 0) {
          y = 'M' + -y
        }
        return urls[index]
          .replace('{x}', x)
          .replace('{y}', y)
          .replace('{z}', z)
      }
    })
  })
  return tileLayer
}
/**
 * @name   getLayer
 * @param  {string} layerName 图层名
 * @return {object} layer 返回layer对象
 * @description 获取指定layer
 */
OlMap.prototype.getLayer = function(layerName) {
  const layers = this.map.getLayers().getArray()
  for (let i = 0; i < layers.length; i++) {
    if (layers[i].get('name') === layerName) {
      return layers[i]
    }
  }
  return false
}

OlMap.prototype.extent2Rect = function(extent, isFeature = true) {
  const coordinates = [
    [extent[0], extent[1]],
    [extent[0], extent[3]],
    [extent[2], extent[3]],
    [extent[2], extent[1]]
  ]

  if (isFeature) {
    coordinates.push(coordinates[0])
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
      }
    }
  } else {
    return coordinates
  }
}
/**
 * @name    toggleLayerVisible
 * @param   {string}  layerName 需要切换隐藏显示的图层名
 * @param   {boolen}  visible [可选参数] 图层是否显示，不传直接取反当前状态
 * @returns {void}
 * @description 切换layer层隐藏显示
 */
OlMap.prototype.toggleLayerVisible = function(layerName, visible) {
  const layer = this.getLayer(layerName)
  if (layer) {
    if (typeof visible === 'undefined') {
      visible = !layer.getVisible()
    }
    layer.setVisible(visible)
  }
}

/**
 * @name    removeLayers
 * @param   {string|array}  layerNames 需要移除的图层名
 * @returns {void}
 * @description 移除指定图层
 */
OlMap.prototype.removeLayers = function(layerNames) {
  if (typeof layerNames === 'string') {
    const layer = this.getLayer(layerNames)
    if (layer) {
      this.map.removeLayer(layer)
    }
  } else if (layerNames instanceof Array) {
    layerNames.forEach(layerName => {
      this.removeLayers(layerName)
    })
  }
}
OlMap.prototype.transformCoordinates = function(coordinates) {
  return transform(coordinates, this.DATA_PROJ, this.DEAFAULT_PROJ)
}

OlMap.prototype.moveFeature = function(layerName, featureId, opts) {
  const layer = this.map.getLayer(layerName)
  if (typeof layer.getSource === 'function') {
    const source = layer.getSource()
    const feature = source.getFeatureById(featureId)
    let geometry = null
    if (opts.type === 'Polygon') {
      const regularPolygon = this.getRegularPolygonCoordinate(opts.edgeNum, opts.edgeLen, opts.coordinates, true)
      const tempCoordinates = []
      tempCoordinates.push(regularPolygon)
      geometry = new geom[opts.type](tempCoordinates).transform(this.DATA_PROJ, this.DEAFAULT_PROJ)
    } else {
      geometry = new geom[opts.type](opts.coordinates).transform(this.DATA_PROJ, this.DEAFAULT_PROJ)
    }
    if (feature) {
      let properties = feature.getProperties()
      properties.center = transform(opts.coordinates, this.DATA_PROJ, this.DEAFAULT_PROJ)
      feature.setProperties(properties)
      feature.setGeometry(geometry)
    }
    // feature.setStyle(feature.getStyle())
    // source.addFeature(feature)
  }
}

/**
 * @name   getRegularPolygonCoordinate
 * @param  {number} edgeNum 正多边形边数
 * @param  {number} edgeLen 正多边形边长
 * @param  {array} center 正多边形中心点坐标
 * @param  {boolen} close 返回坐标点是否要封闭，默认是不封闭
 * @return {array} 返回数组长度为(edgeLen + 1)， 其中第一个点和最后个点坐标一样，为了围城封闭图形
 * @description 根据中心点位置计算出正多边形各个角的坐标
 */
OlMap.prototype.getRegularPolygonCoordinate = function(edgeNum, edgeLen, center, close) {
  const π = Math.PI,
    // 正多边形角坐标
    corners = [],
    cornersLonLat = [],
    // 每像素多少米
    // resolution = this.map.getView().getResolution(),
    // 给定坐标点的经度
    lon = center[0],
    // 给定坐标点的纬度
    lat = center[1],
    // 地球半径
    earthR = 6378137,
    // 以给定坐标点center为原点，edgeLen为边长的正多边形外切圆半径
    // 此圆方程式为 x² + y² = r²
    r = edgeLen / (2 * Math.sin(π / edgeNum)),
    // 计算多边形开始位置的角度
    startDegree = edgeNum % 2 ? 0 : π / edgeNum

  // 例如：
  // 正三边形，x依次为r*sin0, r*sin(0 + 2π/3), r*sin(0 + (2π/3)*2)...
  // 正四边形，x依次为r*sin(π/4), r*sin(π/4 + 2π/4), r*sin(π/4 + (2π/4)*2)...
  for (let i = 0; i < edgeNum; i++) {
    // var x = r * Math.sin(startDegree + i * ((2 * π) / edgeNum))
    corners[i] = []
    corners[i][0] = r * Math.sin(startDegree + i * ((2 * π) / edgeNum))
    corners[i][1] = r * Math.cos(startDegree + i * ((2 * π) / edgeNum))
  }

  for (let i = 0; i < corners.length; i++) {
    const distanceLon = corners[i][0] / (earthR * Math.cos((π * lat) / 180)),
      distanceLat = corners[i][1] / earthR

    cornersLonLat[i] = []
    cornersLonLat[i][0] = lon + (distanceLon * 180) / π
    cornersLonLat[i][1] = lat + (distanceLat * 180) / π
  }

  if (close) {
    cornersLonLat[corners.length] = cornersLonLat[0]
  }
  return cornersLonLat
}

/**
 * @name    connectLine
 * @param   {array} points 连线的点，以连线先后顺序排列
 * @param   {string} layerName 线段添加的图层名
 * @param   {string} color 线段颜色
 * @param   {number} width 线段宽度
 * @returns {void}
 * @description 按所给点顺序依次连接成线
 */
OlMap.prototype.connectLine = function(points, layerName, color, width) {
  let layer = this.getLayer(layerName)
  if (!layer) {
    layer = new VectorLayer({
      name: layerName,
      source: new VectorSource()
    })
  }
  const layerSource = layer.getSource()
  for (let i = 1; i < points.length; i++) {
    var lineEnds = [points[i - 1].geometry.coordinates, points[i].geometry.coordinates]
    const line = new geom.LineString(lineEnds)
    line.transform(this.DATA_PROJ, this.DEAFAULT_PROJ)

    // create the feature
    const lineFeature = new Feature({
      geometry: line,
      name: 'Line'
    })
    // add style for feature
    lineFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color: color,
          width: width
        })
      })
    )
    // add to source
    layerSource.addFeature(lineFeature)
  }
  // update source of layer
  layer.setSource(layerSource)
}
OlMap.prototype.heatmap = function(features, name, visible = true, blur = 20, radius = 20) {
  const heatmap = new HeatmapLayer({
    className: 'ol-layer-heatmap',
    name,
    visible,
    source: new VectorSource({
      features
    }),
    blur,
    radius,
    zIndex: this.getZIndex('heat'),
    weight: function(feature) {
      return feature.getProperties().value
    }
  })
  this.map.addLayer(heatmap)
}
OlMap.prototype.getXYPixel = function(extent, coordinates) {
  const leftTopPixel = this.map.getPixelFromCoordinate([extent[0], extent[3]])
  const pointPixel = this.map.getPixelFromCoordinate(transform(coordinates, this.DATA_PROJ, this.DEAFAULT_PROJ))
  return [pointPixel[0] - leftTopPixel[0], pointPixel[1] - leftTopPixel[1]]
}
/**
 * @name renderLayer
 * @param  {array} points 图层features数据（GeoJson格式）
 * @param  {string} name 图层名
 * @param  {object} customOpt 图层自定义参数，主要是对文字，图片的设定
 * @return {void}
 * @description  渲染图层（有可能是多个图层拼凑一个站点数据）
 */
OlMap.prototype.renderLayer = function(points, name, customOpt) {
  const defaultOpt = {
    pointName: 'pointName',
    pointId: 'pointId',
    pointValue: 'pointValue',
    pointLayer: '',
    pointType: 'point',
    zIndex: this.getZIndex(name),
    image: {
      enable: true,
      type: 'icon',
      anchor: [0.5, 1],
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction',
      snapToPixel: false,
      opacity: this.getImageStyle('opacity'),
      size: this.getImageStyle('size'),
      scale: this.getImageStyle('scale'),
      srcType: 'all', // all or single
      src: '',
      radius: 5,
      fill: {
        color: this.getImageStyle('fillColor')
      },
      stroke: {
        color: this.getImageStyle('strokeColor'),
        width: this.getImageStyle('strokeWidth')
      }
    },
    text: {
      enable: true,
      font: this.getTextStyle('font'),
      text: 'pointName',
      textAlign: 'center',
      textColorType: 'all',
      scale: 1,
      offsetX: 0,
      offsetY: 10,
      fill: {
        color: this.getTextStyle('fillColor')
      },
      stroke: {
        color: this.getTextStyle('strokeColor'),
        width: this.getTextStyle('strokeWidth')
      }
    },
    geometry: {
      enable: true,
      styleType: 'all',
      fill: {
        color: this.getGeometryStyle('fillColor')
      },
      stroke: {
        color: this.getGeometryStyle('strokeColor'),
        width: this.getGeometryStyle('strokeWidth')
      },
      edgeNum: 4,
      edgeLen: 1000
    },
    visible: true,
    popupable: false,
    unit: ''
  }

  const opt = extend(true, {}, defaultOpt, customOpt)

  let newLayer = true
  let pointsLayer = this.getLayer(name)
  let pointsSource = new VectorSource({})
  if (!pointsLayer) {
    pointsLayer = new VectorLayer({
      name: name,
      source: pointsSource
    })
  } else {
    newLayer = false
    pointsSource = pointsLayer.getSource()
  }

  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    const method = opt.pointType[0].toUpperCase() + opt.pointType.slice(1)
    let feature = null
    if (geom[method]) {
      let geometry = null
      // 根据类型来执行对应方法
      if (method === 'Polygon' && point.geometry.coordinates.length === 2 && !(point.geometry.coordinates[0] instanceof Array)) {
        const edgeNum = opt.geometry.styleType === 'all' ? opt.geometry.edgeNum : point.properties.edgeNum
        const edgeLen = opt.geometry.styleType === 'all' ? opt.geometry.edgeLen : point.properties.edgeLen
        const regularPolygon = this.getRegularPolygonCoordinate(edgeNum, edgeLen, point.geometry.coordinates, true)
        const tempCoordinates = []
        tempCoordinates.push(regularPolygon)
        geometry = new geom[method](tempCoordinates).transform(this.DATA_PROJ, this.DEAFAULT_PROJ)
      } else {
        geometry = new geom[method](point.geometry.coordinates).transform(this.DATA_PROJ, this.DEAFAULT_PROJ)
      }
      feature = new Feature({
        geometry: geometry,
        center: transform(point.geometry.coordinates, this.DATA_PROJ, this.DEAFAULT_PROJ),
        name: point.properties[opt.pointName],
        value: point.properties[opt.pointValue],
        data: point.properties
      })
      // 新版本中以这种形式设置feature id
      feature.setId(point.properties[opt.pointId])
    } else {
      return
    }

    // 类型错误
    if (!feature) {
      return
    }

    let featureStyle = new Style({})

    if (opt.image.enable) {
      let imageStyle = {}
      if (opt.image.type === 'circle') {
        imageStyle = new Circle({
          radius: point.properties[opt.pointValue] === '' ? 0 : opt.image.radius,
          snapToPixel: false,
          fill: new Fill({
            color: opt.image.srcType === 'all' ? opt.image.fill.color : point.properties.fillColor
          }),
          stroke: new Stroke({
            color: opt.image.srcType === 'all' ? opt.image.stroke.color : point.properties.strokeColor,
            width: opt.image.srcType === 'all' ? opt.image.stroke.width : point.properties.strokeWidth
          })
        })
      } else if (opt.image.type === 'icon') {
        imageStyle = new Icon({
          anchor: opt.image.anchor,
          anchorXUnits: opt.image.anchorXUnits,
          anchorYUnits: opt.image.anchorYUnits,
          opacity: point.properties[opt.pointValue] === '' ? 0 : opt.image.opacity,
          offset: opt.image.offset,
          size: opt.image.size,
          scale: opt.image.scale,
          src: opt.image.srcType === 'all' ? opt.image.src : point.properties.imageSrc,
          snapToPixel: opt.image.snapToPixel
        })
      } else if (opt.image.type === 'svg') {
        imageStyle = new Icon({
          anchor: opt.image.anchor,
          anchorXUnits: opt.image.anchorXUnits,
          anchorYUnits: opt.image.anchorYUnits,
          opacity: point.properties[opt.pointValue] === '' ? 0 : opt.image.opacity,
          offset: opt.image.offset,
          imgSize: opt.image.size,
          scale: opt.image.scale,
          img: opt.image.srcType === 'all' ? opt.image.img : point.properties.img,
          snapToPixel: opt.image.snapToPixel
        })
      }
      featureStyle.setImage(imageStyle)
    }
    if (opt.text.enable) {
      var fillColor = point.properties[opt.pointValue] === '' ? 'rgba(255, 255, 255, 0)' : opt.text.fill.color
      var strokeColor = point.properties[opt.pointValue] === '' ? 'rgba(255, 255, 255, 0)' : opt.text.stroke.color
      if (opt.text.textColorType !== 'all') {
        fillColor = point.properties.fillColor
        strokeColor = point.properties.strokeColor
      }
      featureStyle.setText(
        new Text({
          font: opt.text.font,
          text: point.properties[opt.text.text] + (opt.unit && opt.unit !== '' ? opt.unit : ''),
          textAlign: opt.text.textAlign,
          scale: opt.text.scale,
          offsetX: opt.text.offsetX,
          offsetY: opt.text.offsetY,
          fill: new Fill({
            color: fillColor
          }),
          stroke: new Stroke({
            color: strokeColor,
            width: opt.text.stroke.width
          })
        })
      )
    }

    if (opt.geometry.enable) {
      featureStyle = new Style({
        fill: new Fill({
          color: opt.geometry.styleType === 'all' ? opt.geometry.fill.color : point.properties.fillColor
        }),
        stroke: new Stroke({
          color: opt.geometry.styleType === 'all' ? opt.geometry.stroke.color : point.properties.strokeColor,
          width: opt.geometry.styleType === 'all' ? opt.geometry.stroke.width : point.properties.strokeWidth
        })
      })
    }
    feature.setStyle(featureStyle)
    pointsSource.addFeature(feature)
  }

  pointsLayer.setSource(pointsSource)
  pointsLayer.setZIndex(opt.zIndex)
  pointsLayer.setVisible(opt.visible)
  if (newLayer) {
    this.map.addLayer(pointsLayer)
  }

  // 设置layer层可点击弹框
  if (opt.popupable) {
    this.setStatus('popupable', name)
  }
}
/**
 * @name    setViewCenter
 * @param   {array}  coordinate 包含经度纬度的数组[long, lat]
 * @param   {number} zoom [可选参数] 放大级别，不传直接获得当前设定的放大级别
 * @returns {void}
 * @description  设定地图中心点
 */
OlMap.prototype.setViewCenter = function(coordinate, zoom) {
  const view = this.map.getView()
  view.animate({
    center: transform(coordinate, this.DATA_PROJ, this.DEAFAULT_PROJ),
    duration: 2000
  })
  if (zoom && !isNaN(zoom) && zoom > 0) {
    view.setZoom(zoom)
  }
}
/**
 * @name d3Layer
 * @param   {function} render 渲染函数 参数extent, resolution, pixelRatio, size, projection
 * @param   {string} layerName 此图层名
 * @param   {boolean} visible 图层是否显示
 * @description 利用canvas绘制图形并渲染到地图中
 * @returns {void}
 */
OlMap.prototype.imageCanvasLayer = function(render, layerName, visible = true) {
  const layer = new ImageLayer({
    name: layerName,
    visible: visible,
    source: new ImageCanvasSource({
      canvasFunction: render
    })
  })
  layer.setZIndex(this.getZIndex(layerName))
  this.map.addLayer(layer)
}
/**
 * @name featureFlash
 * @param {string} layerName 图层名
 * @param {number} featureId 要素id, 用于获取指定要素
 * @param {number} duration 跳动间隔， 单位毫秒
 * @param {function} callback [可选参数] 动画完成后的回调函数
 * @returns {void}
 * @description 指定要算闪动效果
 */
OlMap.prototype.featureFlash = function(layerName, featureId, duration, callback) {
  const layer = this.map.getLayer(layerName)
  const source = layer.getSource()
  const feature = source.getFeatureById(featureId)
  this.setViewCenter(transform(feature.getGeometry().getCoordinates(), this.DEAFAULT_PROJ, this.DATA_PROJ))
  const start = new Date().getTime()
  const style = feature.getStyle()
  const imageStyle = style.getImage()
  let animationId = null

  const render = () => {
    const time = Date.now() - start
    const opacity = ((1 / 500) * time) % 1
    //imageStyle.setOffset(0, -scale)
    imageStyle.setOpacity(opacity)
    feature.setStyle(style)
    this.map.render()
    if (time <= duration) {
      animationId = requestAnimationFrame(render)
    } else {
      cancelAnimationFrame(animationId)
      imageStyle.setOpacity(1)
      // 动画完成后的回调
      if (typeof callback === 'function') {
        callback()
      }
    }
  }
  render()
}

const CustomMap = (function() {
  // 单例模式的唯一实例化
  let gis = null
  return function(settings) {
    if (!gis) {
      gis = new OlMap(settings)
      // 实例化后增加额外的功能
      gis.tools()
      // 重新挂载到map上，在map上暴露调用方法

      gis.map.getContainer = function() {
        return gis.$element
      }
      const excludeMethods = ['tools']
      // 利用代理模式暴露需要的属性和方法
      for (let key in OlMap.prototype) {
        if (Object.prototype.hasOwnProperty.call(OlMap.prototype, key) && !excludeMethods.includes(key)) {
          gis.map[key] = function() {
            return gis[key](...arguments)
          }
        }
      }
    }

    // 只暴露gis内的map对象，从而隐藏gis自身的方法作为私有方法
    return gis.map
  }
})()

export { CustomMap }
