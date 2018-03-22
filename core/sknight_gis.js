/**
 * @author sknight
 * @requires ol,jquery,artTemplate
 * @description 地图实例化，实例化可展示基础地图
 * @see openlayers API http://openlayers.org/en/latest/apidoc/
 * @see 投影讲解 http://hmfly.info/2012/10/17/mercator%E9%82%A3%E4%BA%9B%E4%BA%8B%E5%84%BF/
 * @see mapbox https://www.mapbox.com/api-documentation/#maps
 *
 */
(function(root, factory) {
  "use strict";
  if (typeof define === "function" && define.amd) {
    // AMD
    define(["ol", "jquery", "artTemplate", "./mvi"], factory);
  } else if (typeof exports === "object") {
    // Node, CommonJS之类的
    module.exports = factory(require("ol"), require("jquery"), require("artTemplate"), require("./mvi"));
  } else {
    // 浏览器全局变量(root 即 window)
    var $ = root.Zepto || root.jQuery;
    root.sntMap = factory(root.ol, $, root.template, root.mvi);
  }
})(this, function(ol, $, template, mvi) {
  "use strict";
  // mapbox的access_token,用来加载来自mapbox的瓦格图片
  var access_token = "?access_token=pk.eyJ1Ijoic2tuaWdodCIsImEiOiJjaXg3YWU4ZXMwMTc2MnhxeWljanJnZGNxIn0.pozkMI1zmVRRsfEJglAsmg";

  // 转换为web merctor投影
  var destinationPro = "EPSG:3857";

  // 地理原始投影
  var sourcePro = "EPSG:4326";

  // SntGIS 类
  function SntGIS(settings, basePath) {
    // 一些默认数据基础路径
    if (basePath) {
      this.basePath = basePath;
    } else {
      this.basePath = "../";
    }
    // 默认配置
    var defaults = {
      target: document.getElementById("map"),
      layers: {
        crossOrigin: null,
        baseMap: [
          {
            label: "基础底图",
            url: "https://api.mapbox.com/styles/v1/sknight/cizhzho3x000d2skf0uqrp088/tiles/256/{z}/{x}/{y}" + access_token,
            layerName: "basic"
          }
          // {
          //     label: '街道底图',
          //     url: 'https://api.mapbox.com/styles/v1/sknight/ciy13vljr004f2so6gd293aaz/tiles/256/{z}/{x}/{y}' + access_token,
          //     layerName: 'street',
          // }, {
          //     label: '卫星底图',
          //     url: 'https://api.mapbox.com/styles/v1/sknight/cizhzfx9z000g2spapja22psw/tiles/256/{z}/{x}/{y}' + access_token,
          //     layerName: 'satellite',
          // }
        ],
        boundary: {
          enable: true,
          items: [
            {
              name: "boundary",
              url: this.basePath + "data/boundary-nb.json"
            }
          ]
        },
        station: {
          enable: false,
          name: "stations",
          imgSrc: this.basePath + "images/station.png",
          url: this.basePath + "data/stations.json"
        }
      },
      view: {
        center: [-472202, 7530279],
        rotation: Math.PI / 6,
        zoom: 12
      },
      controls: {
        //回到中心点
        setCenter: {
          enable: false,
          text: "◎"
        },
        //全屏功能
        fullScreen: {
          enable: false
        },
        //鹰眼功能
        overviewMap: {
          enable: false
        },
        // openlayers图标
        attribution: {
          enable: false
        }
      },
      interaction: {
        enable: true,
        target: "type"
      },
      tools: {
        title: false,
        popup: false, // 弹出框
        draw: false,
        switchBaseMap: false, //底图切换
        mousePosition: false
      },
      extent: {
        bound: []
      }
    };

    // 默认图层z-index值
    var zIndex = {
      baseLayer: 50, //底图
      overlay: 100, //普通层
      boundary: 150, //边界
      contour: 405,
      topo: 410,
      draw: 450,
      station: 500, //站点
      stationName: 501,
      stationValue: 502,
      rain: 511, //要素层
      wind: 512,
      temperature: 513,
      popup: 750, //弹框
      control: 1000 //控件
    };

    // 总状态控制
    var status = {
      action: "default",
      popupable: []
    };

    // feature 默认样式
    var featureStyle = {
      image: {
        opacity: "0.75",
        scale: 0.6,
        size: [30, 38],
        radius: 5,
        offset: [-15, -19],
        fillColor: "rgba(3,3,3, 1)",
        strokeColor: "rgba(255, 255, 255, 1)",
        strokeWidth: 1
      },
      text: {
        font: "14px 微软雅黑",
        fillColor: "rgba(3,3,3, 1)",
        strokeColor: "rgba(255, 255, 255, 1)",
        strokeWidth: 1
      },
      geometry: {
        fillColor: "rgba(0,0,0, 0.6)",
        strokeColor: "rgba(0,0,0, 0.6)",
        strokeWidth: 1
      }
    };

    /**
     * 地图view初始
     * @name    view
     * @param {object}  options  view块的配置参数
     * @param {array}  extent  一个包含最小经纬度和最大经纬的一个数组
     */
    var view = function(options, extent) {
      return new ol.View({
        center: ol.proj.transform(options.center, sourcePro, destinationPro),
        zoom: options.zoom,
        minZoom: options.minZoom,
        maxZoom: options.maxZoom,
        extent: extent
      });
    };

    /**
     * 地图layers初始
     * @name    layers
     * @param   {object}  options  layers块的配置参数
     */
    var layers = function(options) {
      var layers = [];
      // 底图
      var baseLayer = new ol.layer.Tile({
        name: options.baseMap[0].layerName,
        source: new ol.source.XYZ({
          url: options.baseMap[0].url,
          crossOrigin: options.crossOrigin
        })
      });
      baseLayer.setZIndex(zIndex["baseLayer"]);
      layers.push(baseLayer);

      // 行政边界
      if (options.boundary.enable) {
        for (var i = 0; i < options.boundary.items.length; i++) {
          var boundary = options.boundary.items[i];
          var boundaryLayer = new ol.layer.Vector({
            name: boundary.name,
            source: new ol.source.Vector({
              url: boundary.url,
              format: new ol.format.GeoJSON({
                defaultDataProjection: sourcePro,
                projection: destinationPro
              })
            }),
            style: new ol.style.Style({
              stroke: new ol.style.Stroke({
                color: boundary.color ? boundary.color : "rgba(43, 140, 218, 0.9)",
                width: boundary.width ? boundary.width : 1
              }),
              fill: new ol.style.Fill({
                color: boundary.fillColor ? boundary.fillColor : "rgba(0, 0, 0, 0)"
              })
            })
          });

          boundaryLayer.setZIndex(zIndex["boundary"] + i);
          layers.push(boundaryLayer);
        }
      }

      // 站点图层
      if (options.station.enable) {
        var stationsLayer = new ol.layer.Vector({
          name: options.station.name,
          source: new ol.source.Vector({
            url: options.station.url,
            format: new ol.format.GeoJSON({})
          }),
          style: new ol.style.Style({
            image: new ol.style.Icon({
              anchor: [0.5, 0.5],
              size: [50, 64],
              offset: [0, 0],
              opacity: 0.5,
              scale: 0.5,
              src: options.station.imgSrc
            })
          })
        });
        stationsLayer.setZIndex(zIndex["station"]);
        layers.push(stationsLayer);
      }

      return layers;
    };

    /**
     * 地图controls初始
     * @name    controls
     * @param   {object}  options controls块的配置参数
     */
    var controls = function(options, gisThis) {
      var controlExtends = [];
      var defaultOptions = {
        attributionOptions: /** @type {olx.control.AttributionOptions} */ ({
          collapsible: false
        })
      };
      var customControl = {};
      customControl.setCenter = function() {
        var button = document.createElement("button");
        button.innerHTML = options.setCenter.text;
        var handleSetCenter = function() {
          gisThis.setViewCenter(gisThis.options.view.center);
        };

        button.addEventListener("click", handleSetCenter, false);
        button.addEventListener("touchstart", handleSetCenter, false);

        var element = document.createElement("div");
        element.className = "back-center ol-unselectable ol-control";
        element.appendChild(button);

        ol.control.Control.call(this, {
          element: element
          //target: self.options.target //如果设置这个参数，自定义的control的DOM会被设置在原有control容器外，不方便控制样式
        });
      };
      // 继承原有的control
      ol.inherits(customControl.setCenter, ol.control.Control);

      // 开启全屏功能
      if (options.fullScreen.enable) {
        controlExtends.push(new ol.control.FullScreen());
      }

      // 开启鹰眼功能
      if (options.overviewMap.enable) {
        controlExtends.push(new ol.control.OverviewMap());
      }

      // 回到中心点
      if (options.setCenter.enable) {
        controlExtends.push(new customControl.setCenter());
      }

      // openlayers Logo 是否开启
      if (!options.attribution.enable) {
        defaultOptions = {
          attribution: false
        };
      }
      return ol.control.defaults(defaultOptions).extend(controlExtends);
    };

    var interactions = function() {
      var select = new ol.interaction.Select();

      var translate = new ol.interaction.Translate({
        features: select.getFeatures()
      });

      return [select, translate];
    };

    var handleEvent = function(options) {
      // 禁用map区域内右键菜单
      $(options.target).attr("oncontextmenu", "return false;");
    };

    this.options = $.extend(true, {}, defaults, settings);

    this.$element = $(this.options.target);

    var extent = ol.extent.boundingExtent(this.options.extent.bound);

    if (Array.isArray(extent) && this.options.extent.bound.length > 1) {
      this.options.extent = ol.proj.transformExtent(extent, sourcePro, destinationPro);
    } else {
      this.options.extent = undefined;
    }

    this.map = new ol.Map({
      target: this.options.target,
      layers: layers(this.options.layers),
      view: view(this.options.view, this.options.extent),
      controls: controls(this.options.controls, this)
      //interactions: interactions()
    });

    handleEvent(this.options);

    this.getZIndex = function(name) {
      return zIndex[name] ? zIndex[name] : 500;
    };

    this.setStatus = function(statusName, statusValue) {
      if (status[statusName] instanceof Array) {
        status[statusName].push(statusValue);
      } else {
        status[statusName] = statusValue;
      }
    };

    this.getStatus = function(statusName) {
      return status[statusName];
    };

    this.getTextStyle = function(name) {
      return featureStyle.text[name];
    };

    this.getImageStyle = function(name) {
      return featureStyle.image[name];
    };

    this.getGeometryStyle = function(name) {
      return featureStyle.geometry[name];
    };
  }

  // tools部分的HTML模板, 附带初始化数据
  SntGIS.prototype.templates = {
    switchBaseMap: {
      tpl:
        '<div id="basemap-switch">' +
        '<div class="btn-group" data-toggle="buttons">' +
        "{{ each radios as radio i }}" +
        '<label for="{{ radio.name }}-map" class="btn btn-{{ radio.name }} ' +
        '{{i==0 ? "active":"" }}' +
        '">' +
        '<input class="base-map" type="radio" value="{{ radio.name }}" id="{{ radio.name }}-map" name="baseMap" {{ i==0?"checked=checked":"" }}>' +
        "{{ radio.label }}</label>" +
        "{{ /each }}" +
        "</div>" +
        "</div>",
      currentVal: "basic"
    },

    popup: {
      tpl: '<div id="popup" class="ol-popup">' + '<a href="#" id="popup-closer" class="ol-popup-closer"></a>' + '<div id="popup-content"></div>' + "</div>"
    },

    draw: {
      tpl:
        '<div id="geometry-select">' +
        "<label>几何类型：</label>" +
        "<select>" +
        '<option value="None" selected>默认</option>' +
        '<option value="Point">点</option>' +
        '<option value="LineString">线</option>' +
        '<option value="Polygon">多边形</option>' +
        '<option value="Circle">圆</option>' +
        "</select>" +
        '<button id="clear-all">清空</button>' +
        "<div>"
    },

    mousePosition: {
      tpl:
        "<form>" +
        "<label>投影类型 </label>" +
        '<select id="projection">' +
        '<option value="EPSG:4326" selected="selected">EPSG:4326</option>' +
        '<option value="EPSG:3857">EPSG:3857</option>' +
        "</select>" +
        "<label>经纬度精度 </label>" +
        '<input id="precision" type="number" min="0" max="12" value="4"/>' +
        "</form>"
    }
  };

  /**
   * @name  tools
   * @description 地图tools初始增加额外的工具
   */
  SntGIS.prototype.tools = function() {
    var options = this.options;
    var self = this;

    self.map.on("singleclick", function(e) {
      if (self.getStatus("action") === "default") {
        var feature = self.map.forEachFeatureAtPixel(e.pixel, function(feature, layer) {
          return feature;
        });

        if (feature) {
          var layerName = "";
          var hit = self.map.forEachFeatureAtPixel(e.pixel, function(feature, layer) {
            if (layer && $.inArray(layer.get("name"), self.getStatus("popupable")) !== -1) {
              layerName = layer.get("name");
              return true;
            } else {
              return false;
            }
          });

          if (hit) {
            var coordinates = feature.getGeometry().getCoordinates();
            var stationName = feature.get("station_name") ? feature.get("station_name") : "";
            var stationInfo = feature.get("info") ? feature.get("info") : "";
            self.$element.trigger("stationClick", [stationInfo, coordinates, layerName, feature.getStyle()]);
          }
        }
      }
    });

    self.map.on("pointermove", function(e) {
      if (self.getStatus("action") === "default") {
        if (e.dragging) {
          return;
        }
        var pixel = self.map.getEventPixel(e.originalEvent);
        var hit = self.map.forEachFeatureAtPixel(e.pixel, function(feature, layer) {
          if (layer && $.inArray(layer.get("name"), self.getStatus("popupable")) !== -1) {
            return true;
          } else {
            return false;
          }
        });

        self.map.getTarget().style.cursor = hit ? "pointer" : "";
      }
    });

    if (options.tools.title) {
    }

    // 绘图功能
    if (options.tools.draw) {
      self.renderHtml(self.templates.draw["tpl"], {}, function() {
        var $typeSelect = $("#geometry-select select");
        var draw;
        var drawSource = new ol.source.Vector({
          wrapX: false
        });
        var drawLayer = new ol.layer.Vector({
          name: "draw",
          source: drawSource
        });
        drawLayer.setZIndex(self.getZIndex("draw"));
        self.map.addLayer(drawLayer);

        function drawInteraction() {
          var value = $typeSelect.val();
          if (value !== "None") {
            self.setStatus("action", "draw");
            draw = new ol.interaction.Draw({
              source: drawSource,
              type: $typeSelect.val(),
              freehand: true
            });
            self.map.addInteraction(draw);
            draw.on("drawend", function(e) {
              var drawFeature = e.feature;
              var layers = self.map.getLayers().getArray();
              var layersFeatures = {};
              for (var i = 0; i < layers.length; i++) {
                var layerFeatures = {};
                var layerName = layers[i].get("name");
                // 只有ol.source.Vector才有features
                if (layers[i].get("source") instanceof ol.source.Vector) {
                  var features = self.getInnerFeatures(layerName, drawFeature);
                  layersFeatures[layerName] = features;
                }
              }
              self.$element.trigger("selectend", layersFeatures);
            });
            draw.on("drawstart", function(e) {
              drawSource.clear();
            });
          } else {
            self.setStatus("action", "default");
          }
        }

        $("#clear-all").on("click", function() {
          drawSource.clear();
        });

        $typeSelect.on("change", function() {
          self.map.removeInteraction(draw);
          drawInteraction();
        });

        drawInteraction();
      });
    }

    // 弹框功能
    if (options.tools.popup) {
      self.renderHtml(self.templates.popup["tpl"], {}, function() {
        var container = document.getElementById("popup");
        var content = document.getElementById("popup-content");
        var closer = document.getElementById("popup-closer");

        var overlay = new ol.Overlay({
          id: "popup",
          element: container,
          autoPan: true, // 弹窗全部显示在地图中
          positioning: "center-center",
          autoPanAnimation: {
            duration: 250
          }
        });

        // 增加popup的overlay层
        self.map.addOverlay(overlay);

        self.map.on("pointermove", function(e) {
          if (self.getStatus("action") === "default") {
            var feature = self.map.forEachFeatureAtPixel(e.pixel, function(feature, layer) {
              return feature;
            });

            if (feature) {
              var layerName = "";
              var hit = self.map.forEachFeatureAtPixel(e.pixel, function(feature, layer) {
                if (layer && $.inArray(layer.get("name"), self.getStatus("popupable")) !== -1) {
                  layerName = layer.get("name");
                  return true;
                } else {
                  overlay.setPosition(undefined);
                  closer.blur();
                  return false;
                }
              });

              if (hit) {
                var coordinates = feature.getGeometry().getCoordinates();
                console.log(coordinates);
                var stationInfo = feature.get("info") ? feature.get("info") : "";
                self.$element.trigger("stationHover", [stationInfo, overlay, $(content), layerName, coordinates]);
              }
            } else {
              //overlay.setPosition(undefined);
              //closer.blur();
              //return false;
            }
          }
        });

        self.map.on("pointermove", function(e) {
          if (self.getStatus("action") === "default") {
            if (e.dragging) {
              overlay.setPosition(undefined);
              return;
            }
            var pixel = self.map.getEventPixel(e.originalEvent);
            var hit = self.map.forEachFeatureAtPixel(e.pixel, function(feature, layer) {
              if (layer && $.inArray(layer.get("name"), self.getStatus("popupable")) !== -1) {
                return true;
              } else {
                return false;
              }
            });

            self.map.getTarget().style.cursor = hit ? "pointer" : "";
          }
        });

        $(closer).on("click", function() {
          overlay.setPosition(undefined);
          closer.blur();
          return false;
        });
      });
    }

    // 切换底图功能
    if (options.tools.switchBaseMap) {
      //console.log(options.layers.getOwnPropertyNames('baseMap').length);
      var data = {};
      data.radios = [];

      for (var i = 0; i < options.layers.baseMap.length; i++) {
        if (options.layers.baseMap[i]) {
          var radio = {};
          radio.name = options.layers.baseMap[i].layerName;
          radio.label = options.layers.baseMap[i].label;
          data.radios.push(radio);
        }
      }
      if (data.radios.length > 1) {
        self.renderHtml(self.templates.switchBaseMap["tpl"], data, function() {
          self.templates.switchBaseMap["currentVal"] = $(".base-map:checked").val();
          var $container = $("#basemap-switch");
          $('input[type="radio"]', $container).on("change", function() {
            $(this)
              .parent()
              .addClass("active");
            $(this)
              .parent()
              .siblings()
              .removeClass("active");
            var oldMapName = self.templates.switchBaseMap["currentVal"];
            var newMapName = (self.templates.switchBaseMap["currentVal"] = $(".base-map:checked", $container).val());
            var newMapSource =
              options.layers.baseMap[
                $(".base-map:checked", $container)
                  .parent()
                  .index()
              ].url;
            self.switchMap(oldMapName, newMapName, newMapSource);
          });
        });
      }
    }

    // 鼠标位置获取经纬度
    if (options.tools.mousePosition) {
      self.renderHtml(self.templates.mousePosition["tpl"], {}, function() {
        var mousePositionControl = new ol.control.MousePosition({
          coordinateFormat: ol.coordinate.createStringXY(4),
          projection: sourcePro,
          className: "mouse-position",
          //target: document.getElementById('mouse-position'),
          undefinedHTML: "&nbsp;"
        });

        self.map.addControl(mousePositionControl);

        $("#projection").on("change", function(e) {
          mousePositionControl.setProjection(ol.proj.get(e.target.value));
        });

        $("#precision").on("change", function(e) {
          mousePositionControl.setCoordinateFormat(ol.coordinate.createStringXY(e.target.valueAsNumber));
        });

        var controls = self.map.getControls();
      });
    }
  };

  /**
   * @name getLayer
   * @param  {string} layerName
   * @return {object} layer 返回layer对象
   * @description 获取指定layer
   */
  SntGIS.prototype.getLayer = function(layerName) {
    var self = this;
    var layers = self.map.getLayers().getArray();
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].get("name") === layerName) {
        return layers[i];
      }
    }
    return false;
  };

  /**
   * @name getRegularPolygonCoordinate
   * @param  {number} edgeNum 正多边形边数
   * @param  {number} edgeLen 正多边形边长
   * @param  {array} center 正多边形中心点坐标
   * @param  {boolen} close 返回坐标点是否要封闭，默认是不封闭
   * @return {array} 返回数组长度为(edgeLen + 1)， 其中第一个点和最后个点坐标一样，为了围城封闭图形
   * @description 根据中心点位置计算出正多边形各个角的坐标
   */
  SntGIS.prototype.getRegularPolygonCoordinate = function(edgeNum, edgeLen, center, close) {
    var π = Math.PI,
      // 正多边形角坐标
      corners = [],
      cornersLonLat = [],
      // 每像素多少米
      resolution = this.map.getView().getResolution(),
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
      startDegree = edgeNum % 2 ? 0 : π / edgeNum;

    // 例如：
    // 正三边形，x依次为r*sin0, r*sin(0 + 2π/3), r*sin(0 + (2π/3)*2)...
    // 正四边形，x依次为r*sin(π/4), r*sin(π/4 + 2π/4), r*sin(π/4 + (2π/4)*2)...
    for (var i = 0; i < edgeNum; i++) {
      var x = r * Math.sin(startDegree + i * (2 * π / edgeNum));

      corners[i] = [];
      corners[i][0] = r * Math.sin(startDegree + i * (2 * π / edgeNum));
      corners[i][1] = r * Math.cos(startDegree + i * (2 * π / edgeNum));
    }

    for (var i = 0; i < corners.length; i++) {
      var distanceLon = corners[i][0] / (earthR * Math.cos(π * lat / 180)),
        distanceLat = corners[i][1] / earthR;

      cornersLonLat[i] = [];
      cornersLonLat[i][0] = lon + distanceLon * 180 / π;
      cornersLonLat[i][1] = lat + distanceLat * 180 / π;
    }

    if (close) {
      cornersLonLat[corners.length] = cornersLonLat[0];
    }
    return cornersLonLat;
  };

  /**
   * @name getInnerFeatures
   * @param  {string} layerName
   * @param  {object} polygonFeature
   * @description 检测某个图层上的feature是不是在指定范围内
   */
  SntGIS.prototype.getInnerFeatures = function(layerName, polygonFeature) {
    var self = this;
    var layer = self.getLayer(layerName);
    var polygonGeometry = polygonFeature.getGeometry();
    var innerFeatures = [];
    if (layer) {
      var source = layer.getSource();
      var features = source.getFeatures();
      for (var i = 0; i < features.length; i++) {
        if (typeof features[i].getGeometry().getCoordinates === "function") {
          var featureCoords = features[i].getGeometry().getCoordinates();
          // 判断站点是否在集合图形内，如果在边界上不算在内部
          // http://openlayers.org/en/latest/apidoc/ol.geom.Polygon.html#intersectsCoordinate
          // 要区分 ol.geom.Polygon.intersectsCoordinate 和 ol.extent.containsCoordinate
          if (polygonGeometry.intersectsCoordinate(featureCoords)) {
            innerFeatures.push(features[i]);
          }
        }
      }
    }
    return innerFeatures;
  };

  /**
   * @name    renderHtml
   * @param   {string}  模板html
   * @param   {object}  模板要插入的数据
   * @param   {function}  模板渲染完毕后要处理的回调函数
   * @description 渲染额外的HTML
   */
  SntGIS.prototype.renderHtml = function(tpl, data, handleActions) {
    var self = this;
    var render = template.compile(tpl);
    var html = render(data);

    self.$element.after(html);

    handleActions();
  };

  /**
   * @name    switchMap
   * @param   {string}  老底图所在图层的layer name
   * @param   {string}  新底图所在图层的layer name
   * @param   {string}  新底图的layer source （这里默认用XYZ）
   * @description 切换地图底图
   */
  SntGIS.prototype.switchMap = function(oldLayerName, newLayerName, newLayerSource) {
    var self = this;
    var layer = self.getLayer(oldLayerName);
    if (layer) {
      var zIndex = layer.getZIndex();
      var newLayer = new ol.layer.Tile({
        name: newLayerName,
        source: new ol.source.XYZ({
          url: newLayerSource
        })
      });
      newLayer.setZIndex(zIndex);
      self.map.removeLayer(layer);
      self.map.addLayer(newLayer);
    }
  };

  /**
   * @name connectLine
   * @param  {array} points 连线的点，以连线先后顺序排列
   * @param  {string} layerName 线段添加的图层名
   * @param  {string} color 线段颜色
   * @param  {number} width 线段宽度
   * @description 按所给点顺序依次连接成线
   */
  SntGIS.prototype.connectLine = function(points, layerName, color, width) {
    var self = this;
    var layer = self.getLayer(layerName);
    if (!layer) {
      layer = new ol.layer.Vector({
        name: layerName,
        source: new ol.source.Vector()
      });
    }
    var layerSource = layer.getSource();
    for (var i = 1; i < points.length; i++) {
      var lineEnds = [points[i - 1].geometry.coordinates, points[i].geometry.coordinates];
      var line = new ol.geom.LineString(lineEnds);
      line.transform(sourcePro, destinationPro);

      // create the feature
      var lineFeature = new ol.Feature({
        geometry: line,
        name: "Line"
      });
      // add style for feature
      lineFeature.setStyle(
        new ol.style.Style({
          stroke: new ol.style.Stroke({
            color: color,
            width: width
          })
        })
      );
      // add to source
      layerSource.addFeature(lineFeature);
    }
    // update source of layer
    layer.setSource(layerSource);
  };

  /**
   * @name    setViewCenter
   * @param   {array}  包含经度纬度的数组[long, lat]
   * @param   {number}  [可选参数] 放大级别，不传直接获得当前设定的放大级别
   * @description  设定地图中心点
   */
  SntGIS.prototype.setViewCenter = function(coordinate, zoom) {
    var view = this.map.getView();
    view.animate({
      center: ol.proj.transform(coordinate, sourcePro, destinationPro),
      duration: 2000
    });
    if (zoom && !isNaN(zoom) && zoom > 0) {
      view.setZoom(zoom);
    }
  };

  /**
   * @name    toggleLayerVisible
   * @param   {string}  需要切换隐藏显示的图层名
   * @param   {boolen}  [可选参数] 图层是否显示，不传直接取反当前状态
   * @description 切换layer层隐藏显示
   */
  SntGIS.prototype.toggleLayerVisible = function(layerName, visible) {
    var self = this;
    var layer = self.getLayer(layerName);
    if (layer) {
      if (typeof visible === "undefined") {
        visible = !layer.getVisible();
      }
      layer.setVisible(visible);
    }
  };

  /**
   * @name    toggleLayerVisible
   * @param   {string|array}  需要移除的图层名
   * @description 移除指定图层
   */
  SntGIS.prototype.removeLayers = function(layerNames) {
    var self = this;
    if (typeof layerNames === "string") {
      var layer = self.getLayer(layerNames);
      if (layer) {
        self.map.removeLayer(layer);
      }
    } else if (layerNames instanceof Array) {
      layerNames.forEach(function(layerName) {
        self.removeLayers(layerName);
      });
    }
  };

  /**
   * @name    clearSource
   * @param   {string|array}  需要移除的图层名
   * @description 清空指定图层source上的全部features, 可用于图层的重新渲染
   */
  SntGIS.prototype.clearSource = function(layerNames) {
    var self = this;
    if (typeof layerNames === "string") {
      var layer = self.getLayer(layerNames);
      if (layer) {
        var source = layer.getSource();
        source.clear();
      }
    } else if (layerNames instanceof Array) {
      layerNames.forEach(function(layerName) {
        self.clearSource(layerName);
      });
    }
  };

  /**
   * @name   togglePointVisible
   * @param  {string} layersName
   * @param  {boolen} visible
   * @description  切换站点隐藏显示 （一个站点的数据，图片等等可能有多个图层共同完成）
   */
  SntGIS.prototype.togglePointVisible = function(layersName, visible) {
    var self = this;
    self.map.getLayers().forEach(function(layer) {
      if ($.inArray(layer.get("name"), layersName) !== -1) {
        var source = layer.getSource();
        var features = source.getFeatures();
        for (var i = 0; i < features.length; i++) {
          var style = features[i].getStyle();
          var image = style.getImage();

          var text = style.getText();
          var value = features[i].get("value");

          if (visible) {
            if (image) {
              if (image instanceof ol.style.Icon) {
                image.setOpacity(self.getImageStyle("opacity"));
              }
              if (image instanceof ol.style.Circle) {
                image.setRadius(self.getImageStyle("radius"));
              }
            }
            if (text) {
              text.setFill(
                new ol.style.Fill({
                  color: self.getTextStyle("fillColor")
                })
              );
              text.setStroke(
                new ol.style.Stroke({
                  color: self.getTextStyle("strokeColor")
                })
              );
            }
          } else {
            if (image) {
              if (image instanceof ol.style.Icon) {
                image.setOpacity(value === "" ? 0 : self.getImageStyle("opacity"));
              }
              if (image instanceof ol.style.Circle) {
                image.setRadius(value === "" ? 0 : self.getImageStyle("radius"));
              }
            }
            if (text) {
              var textFillColor = value === "" ? "rgba(255,255,255,0)" : self.getTextStyle("fillColor");
              var textStrokeColor = value === "" ? "rgba(255,255,255,0)" : self.getTextStyle("strokeColor");
              text.setFill(
                new ol.style.Fill({
                  color: textFillColor
                })
              );
              text.setStroke(
                new ol.style.Stroke({
                  color: textStrokeColor
                })
              );
            }
          }

          style.setImage(image);
          style.setText(text);
          features[i].setStyle(style);
        }
      }
    });
  };

  /**
   * @name addContourImg
   * @param {string} url 图片地址
   * @param {string} name 叠加图片层的图层名
   * @param {array} extent 图片最小经纬度和最大经纬的值
   * @param {array} size 叠加图片大小
   * @param {boolen} visible 初始化状态是否可见
   * @description 增加一个以静态图片展现的等值线图层
   */
  SntGIS.prototype.addContourImg = function(url, name, extent, size, visible) {
    var self = this;
    var contour = new ol.layer.Image({
      name: name,
      opacity: 0.6,
      source: new ol.source.ImageStatic({
        url: url,
        imageSize: size,
        imageExtent: extent,
        projection: sourcePro,
        extent: extent
      })
    });
    contour.setZIndex(self.getZIndex("contour"));
    contour.setVisible(visible);
    self.map.addLayer(contour);
  };

  /**
   * @name renderLayer
   * @param  {array} points 图层features数据（GeoJson格式）
   * @param  {string} name 图层名
   * @param  {object} customOpt 图层自定义参数，主要是对文字，图片的设定
   * @description  渲染图层（有可能是多个图层拼凑一个站点数据）
   */
  SntGIS.prototype.renderLayer = function(points, name, customOpt) {
    var self = this;
    var defaultOpt = {
      pointName: "station_name",
      pointId: "station_id",
      pointValue: "station_value",
      pointType: "point",
      image: {
        enable: true,
        type: "icon",
        anchor: [0.5, 1],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        snapToPixel: false,
        opacity: this.getImageStyle("opacity"),
        size: this.getImageStyle("size"),
        scale: this.getImageStyle("scale"),
        srcType: "all", // all or single
        src: self.basePath + "images/station.png",
        radius: 5,
        fill: {
          color: this.getImageStyle("fillColor")
        },
        stroke: {
          color: this.getImageStyle("strokeColor"),
          width: this.getImageStyle("strokeWidth")
        }
      },
      text: {
        enable: true,
        font: this.getTextStyle("font"),
        text: "station_name",
        textAlign: "center",
        textColorType: "all",
        scale: 1,
        offsetX: 0,
        offsetY: 10,
        fill: {
          color: this.getTextStyle("fillColor")
        },
        stroke: {
          color: this.getTextStyle("strokeColor"),
          width: this.getTextStyle("strokeWidth")
        }
      },
      geometry: {
        styleType: "all",
        fill: {
          color: this.getGeometryStyle("fillColor")
        },
        stroke: {
          color: this.getGeometryStyle("strokeColor"),
          width: this.getGeometryStyle("strokeWidth")
        },
        edgeNum: 4,
        edgeLen: 1000
      },
      visible: true,
      popupable: false,
      unit: ""
    };

    var opt = $.extend(true, {}, defaultOpt, customOpt);

    var newLayer = true;
    var pointsLayer = self.getLayer(name);
    var pointsSource = new ol.source.Vector({});
    if (!pointsLayer) {
      pointsLayer = new ol.layer.Vector({
        name: name,
        source: pointsSource
      });
    } else {
      newLayer = false;
      pointsSource = pointsLayer.getSource();
    }

    for (var i = 0; i < points.length; i++) {
      var point = points[i];
      var method = opt.pointType[0].toUpperCase() + opt.pointType.slice(1);

      if (ol.geom[method]) {
        var geometry = null;
        // 根据类型来执行对应方法
        if (method === "Polygon" && point.geometry.coordinates.length === 2 && !(point.geometry.coordinates[0] instanceof Array)) {
          var regularPolygon = self.getRegularPolygonCoordinate(opt.geometry.edgeNum, opt.geometry.edgeLen, point.geometry.coordinates, true);
          var tempCoordinates = [];
          tempCoordinates.push(regularPolygon);
          geometry = new ol.geom[method](tempCoordinates).transform(sourcePro, destinationPro);
        } else {
          geometry = new ol.geom[method](point.geometry.coordinates).transform(sourcePro, destinationPro);
        }
        var feature = new ol.Feature({
          geometry: geometry,
          name: point.properties[opt.pointName],
          value: point.properties[opt.pointValue],
          info: point.properties
        });
        // 新版本中以这种形式设置feature id
        feature.setId(point.properties[opt.pointId]);
      } else {
        return;
      }

      // 类型错误
      if (!feature) {
        return;
      }

      var featureStyle = new ol.style.Style({});

      if (opt.image.enable) {
        var imageStyle = {};
        if (opt.image.type === "circle") {
          imageStyle = new ol.style.Circle({
            radius: point.properties[opt.pointValue] === "" ? 0 : opt.image.radius,
            snapToPixel: false,
            fill: new ol.style.Fill({
              color: opt.image.srcType === "all" ? opt.image.fill.color : point.properties.fillColor
            }),
            stroke: new ol.style.Stroke({
              color: opt.image.srcType === "all" ? opt.image.stroke.color : point.properties.strokeColor,
              width: opt.image.srcType === "all" ? opt.image.stroke.width : point.properties.strokeWidth
            })
          });
        } else if (opt.image.type === "icon") {
          imageStyle = new ol.style.Icon({
            anchor: opt.image.anchor,
            anchorXUnits: opt.image.anchorXUnits,
            anchorYUnits: opt.image.anchorYUnits,
            opacity: point.properties[opt.pointValue] === "" ? 0 : opt.image.opacity,
            offset: opt.image.offset,
            size: opt.image.size,
            scale: opt.image.scale,
            src: opt.image.srcType === "all" ? opt.image.src : point.properties.imageSrc,
            snapToPixel: opt.image.snapToPixel
          });
        }
        featureStyle.setImage(imageStyle);
      }
      if (opt.text.enable) {
        var fillColor = point.properties[opt.pointValue] === "" ? "rgba(255, 255, 255, 0)" : opt.text.fill.color;
        var strokeColor = point.properties[opt.pointValue] === "" ? "rgba(255, 255, 255, 0)" : opt.text.stroke.color;
        if (opt.text.textColorType !== "all") {
          fillColor = point.properties.fillColor;
          strokeColor = point.properties.strokeColor;
        }
        featureStyle.setText(
          new ol.style.Text({
            font: opt.text.font,
            text: point.properties[opt.text.text] + (opt.unit && opt.unit !== "" ? opt.unit : ""),
            textAlign: opt.text.textAlign,
            scale: opt.text.scale,
            offsetX: opt.text.offsetX,
            offsetY: opt.text.offsetY,
            fill: new ol.style.Fill({
              color: fillColor
            }),
            stroke: new ol.style.Stroke({
              color: strokeColor,
              width: opt.text.stroke.width
            })
          })
        );
      }

      if (opt.geometry.enable) {
        featureStyle = new ol.style.Style({
          fill: new ol.style.Fill({
            color: opt.geometry.styleType === "all" ? opt.geometry.fill.color : point.properties.fillColor
          }),
          stroke: new ol.style.Stroke({
            color: opt.geometry.styleType === "all" ? opt.geometry.stroke.color : point.properties.strokeColor,
            width: opt.geometry.styleType === "all" ? opt.geometry.stroke.width : point.properties.strokeWidth
          })
        });
      }

      feature.setStyle(featureStyle);
      pointsSource.addFeature(feature);
    }

    pointsLayer.setSource(pointsSource);
    pointsLayer.setZIndex(self.getZIndex(name));
    pointsLayer.setVisible(opt.visible);
    if (newLayer) {
      self.map.addLayer(pointsLayer);
    }

    // 设置layer层可点击弹框
    if (opt.popupable) {
      self.setStatus("popupable", name);
    }
  };

  /**
   * @name renderGraticule
   * @description 渲染经纬度网格线
   */
  SntGIS.prototype.renderGraticule = function() {
    var graticule = new ol.Graticule({
      // the style to use for the lines, optional.
      strokeStyle: new ol.style.Stroke({
        color: "rgba(255,120,0,0.9)",
        width: 2,
        lineDash: [0.5, 4]
      }),
      showLabels: true
    });

    return graticule;
  };

  /**
   * @name addPopover
   * @param  {array} coordinate 提示框坐标点
   * @param  {string} positioning 围绕点偏移方式
   * @param  {string} id 提示框DOM id
   * @param  {string} contentHtml 提示框内部内容
   * @description 增加小型提示框
   */
  SntGIS.prototype.addPopover = function(coordinate, positioning, id, contentHtml) {
    var self = this;
    self.$element.append('<div class="container-popover" id="container-' + id + '">' + contentHtml + "</div");

    var popover = new ol.Overlay({
      id: "popover-" + id,
      offset: [0.5, 0.5],
      element: document.getElementById("container-" + id),
      autoPan: true, // 弹窗全部显示在地图中
      positioning: positioning,
      autoPanAnimation: {
        duration: 250
      }
    });

    self.map.once("postrender", function() {
      self.map.addOverlay(popover);
    });

    if (coordinate instanceof Array && coordinate.length === 2) {
      popover.setPosition(ol.proj.transform(coordinate, sourcePro, destinationPro));
    } else {
      popover.setPosition(undefined);
    }
  };

  /**
   * @name d3Layer
   * @param   {function} d3Render d3渲染函数
   * @param   {string} layerName 此图层名
   * @description 利用D3.js在canvas中绘制SVG 并渲染到地图中
   */
  SntGIS.prototype.d3Layer = function(d3Render, layerName) {
    var self = this;
    var layer = new ol.layer.Image({
      source: new ol.source.ImageCanvas({
        name: layerName,
        canvasFunction: d3Render,
        projection: destinationPro
      })
    });
    layer.setZIndex(self.getZIndex(layerName));
    self.map.addLayer(layer);
  };

  /**
   * @name hideNoDataPoiint
   * @param  {string} layerName 图层名
   * @param  {string} key 在GeoJson里的propreties内部的索引名称，此索引对应的值来判断是否是无效值
   * @param  {string|number|undefined|null} noValue 设定的无效值的值，例如（'无', 0, undefined, null）
   * @description 隐藏指定图层中认为是无效值的features
   */
  SntGIS.prototype.hideNoDataPoint = function(layerName, key, noValue) {
    var self = this;
    var layer = self.getLayer(layerName);
    if (layer) {
      var source = layer.getSource();
      var features = source.getFeatures();

      for (var i = 0; i < features.length; i++) {
        var style = features[i].getStyle();
        var image = style.getImage();
        var text = style.getText();
        var noChange = true;

        if (features[i].getProperties().info[key] === noValue) {
          if (image) {
            if (image instanceof ol.style.Icon) {
              image.setOpacity(0);
            }
            if (image instanceof ol.style.Circle) {
              image.setRadius(0);
            }
          }
          if (text) {
            text.setFill(
              new ol.style.Fill({
                color: "rgba(255,255,255,0)"
              })
            );
            text.setStroke(
              new ol.style.Stroke({
                color: "rgba(255,255,255,0)"
              })
            );
          }
          style.setImage(image);
          style.setText(text);
          features[i].setStyle(style);
        }
      }
    }
  };

  /**
   * @name modifyFeatueValue
   * @param  {object} feature 站点feature
   * @param  {number} value 要处理的值
   * @param  {string} operation 对原值的操作 add 加| minus 减| replace 替换
   * @description  修改feature值
   */
  SntGIS.prototype.modifyFeatureValue = function(feature, value, operation, unit) {
    var style = feature.getStyle();
    var text = style.getText();
    var val = parseFloat(text.getText());

    switch (operation) {
      case "add":
        val = val + parseFloat(value);
        break;
      case "minus":
        val = val - parseFloat(value);
        break;
      case "replace":
        val = parseFloat(value);
        break;
      default:
        break;
    }
    text.setText(val + unit + "");
    style.setText(text);
    feature.setStyle(style);
    feature.set("value", val);
    return val;
  };

  /**
   * @name getLayerFeatures
   * @param  {string} layerName 图层名
   * @param  {string} featureId feature id，一般为站点编号
   * @description 获得指定vector类型图层的全部features
   */
  SntGIS.prototype.getLayerFeatures = function(layerName, featureId) {
    var self = this;
    var layer = self.getLayer(layerName);
    if (layer.get("source") instanceof ol.source.Vector) {
      var source = layer.get("source");
      if (featureId && featureId !== "") {
        return source.getFeatureById(featureId);
      }
      return source.getFeatures();
    } else {
      console.log("你的图层" + layerName + "不是vector类型图层，无法获取features");
    }
  };

  /**
   * @name removeLayerFeatures
   * @param  {string} layerName 图层名
   * @param  {string} featureId feature id，一般为站点编号
   * @description 移除指定vector类型图层的全部features
   */
  SntGIS.prototype.removeLayerFeatures = function(layerName, featureId) {
    var self = this;
    var layer = self.getLayer(layerName);
    if (layer.get("source") instanceof ol.source.Vector) {
      var source = layer.get("source");
      if (featureId && featureId !== "") {
        feature = source.getFeatureById(featureId);
        source.removeFeature(feature);
      } else {
        source.clear();
      }
    } else {
      console.log("你的图层" + layerName + "不是vector类型图层，无法获取features");
    }
  };

  // todo 待完成
  SntGIS.prototype.nearest = function(curPoint, points, num) {
    var newPoints = [];
    $.map(points, function(point, i) {
      var newpoint = {};
      return newPoints.push(ol.proj.transform(point.geometry.coordinates, sourcePro, destinationPro));
    });
    var node = mvi.kdTree(newPoints, 2, 0);
    console.log(newPoints);
  };

  // 利用代理模式暴露需要的属性和方法
  var SntMap = (function() {
    // 单例模式的唯一实例化
    var gis;
    return function(settings, basePath) {
      if (!gis) {
        gis = new SntGIS(settings, basePath);
        // 实例化后增加额外的功能
        gis.tools();

        // 重新挂载到map上，在map上暴露调用方法

        // 设置中心点位置
        gis.map.setViewCenter = function(coordinate, zoom) {
          return gis.setViewCenter(coordinate, zoom);
        };
        // 渲染图层，只针对vector类型图层
        gis.map.renderLayer = function(geoData, name, customOpt) {
          return gis.renderLayer(geoData, name, customOpt);
        };
        // 隐藏/显示站点
        gis.map.togglePointVisible = function(layersName, visible) {
          return gis.togglePointVisible(layersName, visible);
        };
        // 隐藏/显示图层
        gis.map.toggleLayerVisible = function(layerName, visible) {
          return gis.toggleLayerVisible(layerName, visible);
        };
        // 移除图层
        gis.map.removeLayers = function(layerNames) {
          return gis.removeLayers(layerNames);
        };
        // 结合D3动态展示风向风速
        gis.map.d3Layer = function(d3Render, layerName) {
          return gis.d3Layer(d3Render, layerName);
        };
        // 隐藏无用点
        gis.map.hideNoDataPoint = function(layerName, key, noValue) {
          return gis.hideNoDataPoint(layerName, key, noValue);
        };
        // 添加等值线图
        gis.map.addContourImg = function(url, name, extent, size, visible) {
          return gis.addContourImg(url, name, extent, size, visible);
        };
        // 站点之间连线
        gis.map.connectLine = function(points, layerName, color, width) {
          return gis.connectLine(points, layerName, color, width);
        };
        // 清除source上的所有feature
        gis.map.clearSource = function(layerNames) {
          return gis.clearSource(layerNames);
        };
        // 渲染网格
        gis.map.renderGraticule = function() {
          var graticule = gis.renderGraticule();
          graticule.setMap(gis.map);
        };
        // 修改要素值
        gis.map.modifyFeatureValue = function(feature, value, operation, unit) {
          return gis.modifyFeatureValue(feature, value, operation, unit);
        };
        // 增加小型提示框
        gis.map.addPopover = function(coordinate, positioning, id, contentHtml) {
          return gis.addPopover(coordinate, positioning, id, contentHtml);
        };
        // 根据中心点坐标获取正多边形各个角坐标
        gis.map.getRegularPolygonCoordinate = function(edgeLen, edgeNum, centerCoordinate) {
          return gis.getRegularPolygonCoordinate(edgeLen, edgeNum, centerCoordinate);
        };
        // 获取图层全部featues
        gis.map.getLayerFeatures = function(layerName, featureId) {
          return gis.getLayerFeatures(layerName, featureId);
        };
        // 移除要素
        gis.map.removeLayerFeatures = function(layerName, featureId) {
          return gis.removeLayerFeatures(layerName, featureId);
        };

        gis.map.nearest = function(curPoint, points, num) {
          return gis.nearest(curPoint, points, num);
        };
      }

      // 只暴露gis内的map对象，从而隐藏gis自身的方法作为私有方法
      return gis.map;
    };
  })();

  return SntMap;
});
