/**
 * @author sknight
 * @requires ol,jquery,artTemplate
 * @description 地图实例化，实例化可展示基础地图
 * @see openlayers API http://openlayers.org/en/latest/apidoc/
 * @see 投影讲解 http://hmfly.info/2012/10/17/mercator%E9%82%A3%E4%BA%9B%E4%BA%8B%E5%84%BF/
 * @see mapbox https://www.mapbox.com/api-documentation/#maps
 *
 */
import 'ol/ol.css'
import { Map, View, Feature } from 'ol'
import GeoJSON from 'ol/format/GeoJSON'
import { defaults as defaultControls, FullScreen, OverviewMap } from 'ol/control'
import { transform, transformExtent } from 'ol/proj'
import { boundingExtent } from 'ol/extent'
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer'
import * as geom from 'ol/geom'
import { Stroke, Style, Fill, Circle, Text, Icon } from 'ol/style'
import { XYZ, Vector as VectorSource } from 'ol/source'
import { BackToCenter } from '@/assets/scripts/olControl.js'
// import { dealCoord } from '@/assets/scripts/dealCoord.js'

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
          label: '基础底图',
          url: 'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          layerName: 'basic'
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
      }
    },
    tools: {
      popup: false, // 弹出框
      switchTile: false //底图切换
    },
    extent: {
      bound: []
    }
  }

  zIndex = {
    baseLayer: 50, //底图
    overlay: 100, //普通层
    boundary: 150, //边界
    contour: 405,
    topo: 410,
    draw: 450,
    station: 500, //站点
    stationName: 501,
    stationValue: 502,
    popup: 750, //弹框
    control: 1000 //控件
  }

  // feature 默认样式
  featureStyle = {
    image: {
      opacity: '0.75',
      scale: 0.6,
      size: [100, 100],
      radius: 5,
      offset: [-50, -50],
      fillColor: 'rgba(3,3,3, 1)',
      strokeColor: 'rgba(255, 255, 255, 1)',
      strokeWidth: 1
    },
    text: {
      font: '14px 微软雅黑',
      fillColor: 'rgba(255,255,255, 1)',
      strokeColor: 'rgba(160, 160, 160, 1)',
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
      zoom: options.zoom,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      extent: extent
    })
  }
  layers = function(options) {
    var layers = []
    // 底图
    var baseLayer = new TileLayer({
      name: options.baseMap[0].layerName,
      source: new XYZ({
        url: options.baseMap[0].url,
        crossOrigin: options.crossOrigin,
        tileLoadFunction: function(tile, src) {
          tile.getImage().src = src
        }
      })
    })
    baseLayer.setZIndex(this.zIndex['baseLayer'])
    layers.push(baseLayer)

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
  controls = function(options, viewOptions) {
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

    return defaultControls(defaultOptions).extend(controlExtends)
  }

  constructor(settings) {
    this.options = extend(true, {}, this.defaults, settings)

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
      controls: this.controls(this.options.controls, this.options.view)
    })

    this.getZIndex = function(name) {
      return this.zIndex[name] ? this.zIndex[name] : 500
    }

    this.setStatus = function(statusName, statusValue) {
      if (status[statusName] instanceof Array) {
        status[statusName].push(statusValue)
      } else {
        status[statusName] = statusValue
      }
    }

    this.getStatus = function(statusName) {
      return status[statusName]
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
  // 切换底图功能
  if (options.tools.switchTile) {
  }
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
    var distanceLon = corners[i][0] / (earthR * Math.cos((π * lat) / 180)),
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
        var regularPolygon = this.getRegularPolygonCoordinate(opt.geometry.edgeNum, opt.geometry.edgeLen, point.geometry.coordinates, true)
        var tempCoordinates = []
        tempCoordinates.push(regularPolygon)
        geometry = new geom[method](tempCoordinates).transform(this.DATA_PROJ, this.DEAFAULT_PROJ)
      } else {
        geometry = new geom[method](point.geometry.coordinates).transform(this.DATA_PROJ, this.DEAFAULT_PROJ)
      }
      feature = new Feature({
        geometry: geometry,
        name: point.properties[opt.pointName],
        value: point.properties[opt.pointValue],
        info: point.properties
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

// 利用代理模式暴露需要的属性和方法
const CustomMap = (function() {
  // 单例模式的唯一实例化
  let gis = null
  return function(settings) {
    if (!gis) {
      gis = new OlMap(settings)
      // 实例化后增加额外的功能
      gis.tools()

      // 重新挂载到map上，在map上暴露调用方法
      // 渲染图层，只针对vector类型图层
      gis.map.getLayer = function(layerName) {
        return gis.getLayer(layerName)
      }
      // 设置中心点位置
      gis.map.setViewCenter = function(coordinate, zoom) {
        return gis.setViewCenter(coordinate, zoom)
      }
      // 渲染图层，只针对vector类型图层
      gis.map.renderLayer = function(geoData, name, customOpt) {
        return gis.renderLayer(geoData, name, customOpt)
      }
      // 隐藏/显示站点
      gis.map.togglePointVisible = function(layersName, visible) {
        return gis.togglePointVisible(layersName, visible)
      }
      // 隐藏/显示图层
      gis.map.toggleLayerVisible = function(layerName, visible) {
        return gis.toggleLayerVisible(layerName, visible)
      }
      // 移除图层
      gis.map.removeLayers = function(layerNames) {
        return gis.removeLayers(layerNames)
      }

      // 站点之间连线
      gis.map.connectLine = function(points, layerName, color, width) {
        return gis.connectLine(points, layerName, color, width)
      }

      // 增加小型提示框
      gis.map.addPopover = function(coordinate, positioning, id, contentHtml) {
        return gis.addPopover(coordinate, positioning, id, contentHtml)
      }
      // 根据中心点坐标获取正多边形各个角坐标
      gis.map.getRegularPolygonCoordinate = function(edgeLen, edgeNum, centerCoordinate) {
        return gis.getRegularPolygonCoordinate(edgeLen, edgeNum, centerCoordinate)
      }
    }

    // 只暴露gis内的map对象，从而隐藏gis自身的方法作为私有方法
    return gis.map
  }
})()

export { CustomMap }
