/**
 * This file support for D3(v3)
 * Function 'getProjection' and D3 methods are different
 */
(function(root, factory) {
  "use strict";
  if (typeof define === "function" && define.amd) {
    // AMD
    define(["../core/mvi", "when", "d3", "topojson"], factory);
  } else if (typeof exports === "object") {
    // Node, CommonJS之类的
    module.exports = factory(require("../core/mvi", "when", "d3", "topojson"));
  } else {
    // 浏览器全局变量(root 即 window)
    root.wind = factory(root.mvi, root.when, root.d3, root.topojson);
  }
})(this, function(mvi, when, d3, topojson) {
  "use strict";
  var τ = 2 * Math.PI;
  var MAX_TASK_TIME = 100; // amount of time before a task yields control (milliseconds)
  var MIN_SLEEP_TIME = 25; // amount of time a task waits before resuming (milliseconds)
  var INVISIBLE = -1; // an invisible vector
  var NIL = -2; // non-existent vector
  var SOURCE_PROJECTION = "EPSG:4326";

  var RECIPES = {
    temp: {
      min: -10,
      max: 35,
      scale: "line",
      precision: 1,
      label: "气温 Temperature",
      unit: "ºC"
    },
    hum: {
      min: 0,
      max: 100,
      scale: "line",
      precision: 1,
      label: "湿度 Humidity",
      unit: "%"
    },
    wv: {
      min: 1,
      max: 20,
      scale: "log",
      precision: 1,
      label: "风速 Wind Velocity",
      unit: " m/s"
    },
    in: {
      min: 0.1,
      max: 4.0,
      scale: "log",
      precision: 2,
      label: "日照量 Insolation",
      unit: ' MJ/m<span class="sup">2</span>'
    },
    no: {
      min: 0.001,
      max: 0.6,
      scale: "log",
      precision: 0,
      label: "一氧化氮 Nitric Monoxide",
      unit: " ppb",
      multiplier: 1000
    },
    no2: {
      min: 0.001,
      max: 0.2,
      scale: "log",
      precision: 0,
      label: "二氧化氮 Nitrogen Dioxide",
      unit: " ppb",
      multiplier: 1000
    },
    nox: {
      min: 0.001,
      max: 0.6,
      scale: "log",
      precision: 0,
      label: "氮氧化合物 Nitrogen Oxides",
      unit: " ppb",
      multiplier: 1000
    },
    ox: {
      min: 0.001,
      max: 0.25,
      scale: "log",
      precision: 0,
      label: "光化学氧化物 Photochemical Oxidants",
      unit: " ppb",
      multiplier: 1000
    },
    so2: {
      min: 0.001,
      max: 0.11,
      scale: "log",
      precision: 0,
      label: "二氧化硫 Sulfur Dioxide",
      unit: " ppb",
      multiplier: 1000
    },
    co: {
      min: 0.1,
      max: 3.0,
      scale: "log",
      precision: 1,
      label: "一氧化碳 Carbon Monoxide",
      unit: " ppm"
    },
    ch4: {
      min: 1.5,
      max: 3.0,
      scale: "log",
      precision: 2,
      label: "甲烷 Methane",
      unit: " ppm"
    },
    nmhc: {
      min: 0.01,
      max: 1.3,
      scale: "log",
      precision: 2,
      label: "无甲烷碳氢化合物 Non-Methane Hydrocarbons",
      unit: " ppm"
    },
    spm: {
      min: 1,
      max: 750,
      scale: "log",
      precision: 0,
      label: "悬浮颗粒物 Suspended Particulate Matter",
      unit: ' μg/m<span class="sup">3</span>'
    },
    pm25: {
      min: 1,
      max: 750,
      scale: "log",
      precision: 0,
      label: "微小颗粒物 2.5µm Particulate Matter",
      unit: ' μg/m<span class="sup">3</span>'
    }
  };

  /**
   * @param  {} lng0
   * @param  {} lat0
   * @param  {} lng1
   * @param  {} lat1
   * @param  {} projection
   * Returns an object that describes the location and size of the map displayed on screen.
   */
  var createDisplayBounds = function(lng0, lat0, lng1, lat1, projection) {
    var upperLeft = projection([lng0, lat1]).map(Math.floor);
    var lowerRight = projection([lng1, lat0]).map(Math.ceil);
    return {
      x: upperLeft[0],
      y: upperLeft[1],
      width: lowerRight[0] - upperLeft[0] + 1,
      height: lowerRight[1] - upperLeft[1] + 1
    };
  };

  /**
   * @param  {number} r red [0,255]
   * @param  {number} g green [0,255]
   * @param  {number} b blue [0,255]
   * @param  {number} a alphe [0,1]
   * @description 返回颜色
   */
  var asColorStyle = function(r, g, b, a) {
    return "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";
  };

  /**
   * @param {} hue the hue rotation in the range [0, 1]
   * @param {} a the alpha value in the range [0, 1]
   * @returns {string} rgba style string
   * @description 利用正弦函数sin波去映射出一段颜色， 映射区间是hue[0,1]到sin[0,(5/3)π]，这样做是为了防止hue=0和hue=1映射到同个颜色
   * 参考：http://krazydad.com/tutorials/makecolors.php.
   *
   * Produces a color style in a rainbow-like trefoil color space. Not quite HSV, but produces a nice
   * spectrum. See http://krazydad.com/tutorials/makecolors.php.
   */
  var asRainbowColorStyle = function(hue, a) {
    // Map hue [0, 1] to radians [0, 5/6τ]. Don't allow a full rotation because that keeps hue == 0 and
    // hue == 1 from mapping to the same color.
    var rad = hue * τ * 5 / 6;
    rad *= 0.75; // increase frequency to 2/3 cycle per rad

    var s = Math.sin(rad);
    var c = Math.cos(rad);
    var r = Math.floor(Math.max(0, -c) * 255);
    var g = Math.floor(Math.max(s, 0) * 255);
    var b = Math.floor(Math.max(c, 0, -s) * 255);
    return asColorStyle(r, g, b, a);
  };

  /**
   * @param  {object} topo topoJSON
   * @param  {object} view openlayers的canvasFunction回调函数回传的canvas size
   * @param  {object} projection openlayers的canvasFunction回调函数回传的Mercotr投影
   */
  var createSettings = function(topo, projection, view) {
    var isFF = /firefox/i.test(navigator.userAgent);
    // 用Merctor投影将要素投到openlayers上，舍弃原本的Albers投影
    // 如果使用Albers投影， 1.会与openlayers底图有偏差，2.由于是静态的，不会与地图放大缩小拖动进行联动
    //var projection = createAlbersProjection(topo.bbox[0], topo.bbox[1], topo.bbox[2], topo.bbox[3], view);
    var bounds = createDisplayBounds(topo.bbox[0], topo.bbox[1], topo.bbox[2], topo.bbox[3], projection);
    var styles = [];
    var settings = {
      projection: projection,
      displayBounds: bounds,
      // 粒子总数
      particleCount: Math.round(bounds.height / 0.24),
      // 一个粒子存在的最大帧数
      // max number of frames a particle is drawn before regeneration
      maxParticleAge: 40,
      velocityScale: +(bounds.height / 700).toFixed(3), // particle speed as number of pixels per unit vector
      fieldMaskWidth: isFF ? 2 : Math.ceil(bounds.height * 0.06), // Wide strokes on FF are very slow
      fadeFillStyle: isFF ? "rgba(0, 0, 0, 0.95)" : "rgba(0, 0, 0, 0.97)", // FF Mac alpha behaves differently
      // 帧率
      // desired milliseconds per frame
      frameRate: 60,
      styles: styles,
      styleIndex: function(m) {
        // map wind speed to a style
        return Math.floor(Math.min(m, 10) / 10 * (styles.length - 1));
      }
    };
    // 粒子渐变色
    for (var j = 85; j <= 255; j += 5) {
      styles.push(asColorStyle(j, j, j, 1));
    }
    return settings;
  };

  /**
   * @param  {} topo
   * @param  {} settings
   */
  var buildMeshes = function(topo, settings) {
    var path = d3.geo.path().projection(settings.projection);
    var outerBoundary = topojson.mesh(topo, topo.objects.counties, function(a, b) {
      return a === b;
    });
    var divisionBoundaries = topojson.mesh(topo, topo.objects.counties, function(a, b) {
      return a !== b;
    });

    return {
      path: path,
      outerBoundary: outerBoundary,
      divisionBoundaries: divisionBoundaries
    };
  };

  /**
   * Returns a promise that resolves to the specified value after a short nap.
   */
  var nap = function(value) {
    var d = when.defer();
    setTimeout(function() {
      d.resolve(value);
    }, MIN_SLEEP_TIME);
    return d.promise;
  };

  /**
   * @param  {} meshpolyfill
   * @param  {object} settings
   * @param  {object} view
   * @description 构建一个新的canvas作为蒙版，掩饰那些超出边界的粒子（粒子没有被销毁，只是不显示）
   *
   * Returns a pair of functions {fieldMask: f(x, y), displayMask: f(x, y)} that return true if the pixel
   * (x, y) is not masked.
   *
   * The field mask defines the area where the wind vector field is available. The field extends beyond the
   * borders of the visible map to provide a more natural looking animation (particles don't die immediately
   * upon hitting the visible border).
   *
   * The display mask defines the area where the animation is visible on screen.
   */
  var renderMasks = function(mesh, settings, view) {
    // To build the masks, re-render the map to a detached canvas and use the resulting pixel data array.
    // The red color channel defines the field mask, and the green color channel defines the display mask.
    var canvas = document.createElement("canvas"); // create detached canvas
    d3
      .select(canvas)
      .attr("width", view.width)
      .attr("height", view.height);
    var g = canvas.getContext("2d");
    // create a path for the canvas
    var path = d3.geo
      .path()
      .projection(settings.projection)
      .context(g);
    // define the border
    path(mesh.outerBoundary);

    // draw a fat border in red
    // 用红色通道填充粒子边距，边距稍微比行政边界大一点，用来更好的渲染边缘粒子动态效果
    g.strokeStyle = asColorStyle(255, 0, 0, 1);
    g.lineWidth = settings.fieldMaskWidth;
    g.stroke();

    // fill the interior with both red and green
    // 用红，绿色通道填充整个区域
    g.fillStyle = asColorStyle(255, 255, 0, 1);
    g.fill();

    // draw a small border in red, slightly shrinking the display mask so we don't draw particles directly
    // on top of the visible SVG border
    // 再用红色通道勾勒出行政区域边缘，防止粒子的运动遮盖在行政区域的边框上
    g.strokeStyle = asColorStyle(255, 0, 0, 1);
    g.lineWidth = 2;
    g.stroke();

    // d3.select(DISPLAY_ID).node().appendChild(canvas);  // uncomment to make mask visible for debugging

    // 获得指定矩形内每个像素数值，一个像素点对应[r,g,b,a]
    // 所以data.length = canvas.width * canvas.height * 4, 最后一个alpha值是0~255
    var data = g.getImageData(0, 0, canvas.width, canvas.height).data;

    // 存储canvs宽度用来定位查找坐标点是否显示
    var width = canvas.width;

    return {
      /**
       * @param  {number} x canvas内部的x位置
       * @param  {number} y canvas内部的y位置
       * @description 根据[r,g,b,a]第一个参数（红色通道）来判断该坐标上的像素是否显示
       */
      fieldMask: function(x, y) {
        // red channel is field mask
        // 红色通道作为粒子蒙版
        var i = (y * width + x) * 4;
        return data[i] > 0;
      },
      /**
       * @param  {number} x canvas内部的x位置
       * @param  {number} y canvas内部的y位置
       * @description 根据[r,g,b,a]第二个参数（绿色通道）来判断该坐标上的像素是否显示
       */
      displayMask: function(x, y) {
        // green channel is display mask
        // 绿色通道作为显示蒙版
        var i = (y * width + x) * 4 + 1;
        return data[i] > 0;
      }
    };
  };

  /**
   * Draws the map on screen and returns a promise for the rendered field and display masks.
   */
  var render = function(settings, mesh, view) {
    // return when(renderMap(mesh))
    //     .then(nap) // temporarily yield control back to the browser to maintain responsiveness
    //     .then(renderMasks.bind(null, mesh, settings));
    return when().then(renderMasks.bind(null, mesh, settings, view));
  };

  /**
   * @param  {object} sample
   * @description 判断样例风速风向是否合法
   */
  var isValidSample = function(sample) {
    return sample.wd === +sample.wd && sample.wv === +sample.wv;
  };

  /**
   * @name buildPontsFramSamples
   * @param  {array} stations
   * @param  {array} samples
   * @param  {function} projection
   * @param  {function} transform
   * @description 构建一个在ESPG:3857投影下的数据结构[经度,纬度，[x轴上的单位向量,y轴上的单位向量]]
   * Converts samples to points in pixel space with the form [x, y, v], where v is the sample value at that point.
   * The transform callback extracts the value v from the sample, or null if the sample is not valid.
   */
  var buildPointsFromSamples = function(stations, samples, projection, transform) {
    var points = [];
    samples.forEach(function(sample) {
      var point = projection(stations[sample.stationId].coordinates);
      var value = transform(sample);
      if (value !== null) {
        points.push([point[0], point[1], value]);
      }
    });
    return points;
  };

  /**
   * @name binarySearch
   * @param  {array} a
   * @param  {number} v
   * @description 二分法检索,返回值的索引
   * @description Returns the index of v in array a (adapted from Java and darkskyapp/binary-search).
   */
  var binarySearch = function(a, v) {
    var low = 0,
      high = a.length - 1;
    while (low <= high) {
      // >> 1 除以2, 运算速度比除法快
      var mid = low + ((high - low) >> 1),
        p = a[mid];
      if (p < v) {
        low = mid + 1;
      } else if (p === v) {
        return mid;
      } else {
        high = mid - 1;
      }
    }
    // ?
    return -(low + 1);
  };

  /**
   * @name name
   * @param  {object} wind
   * @description 构建风向量（用单位向量表示），正北为0度角，详情看http://mst.nerc.ac.uk/wind_vect_convs.html
   * Converts a meteorological wind vector to a u,v-component vector in pixel space. For example, given wind
   * from the NW at 2 represented as the vector [315, 2], this method returns [1.4142..., 1.4142...], a vector
   * (u, v) with magnitude 2, which when drawn on a display would point to the SE (lower right). See
   * http://mst.nerc.ac.uk/wind_vect_convs.html.
   */
  var componentize = function(wind) {
    var φ = wind[0] / 360 * τ; // meteorological wind direction in radians
    var m = wind[1]; // wind velocity, m/s
    var u = -m * Math.sin(φ); // u component, zonal velocity
    var v = -m * Math.cos(φ); // v component, meridional velocity
    // canvas坐标系和常规二维坐标系在Y轴上方向相反的，所以取反来显示运动轨迹的合理
    return [u, -v]; // negate v because pixel space grows downwards
  };

  /**
   * @param  {number} min
   * @param  {number} max
   * @description 返回区间[min, max)内的随机函数
   * @description Returns a random number between min (inclusive) and max (exclusive).
   */
  var rand = function(min, max) {
    return min + Math.random() * (max - min);
  };

  /**
   * @param  {} columns
   *
   * Returns a function f(x, y) that defines a vector field. The function returns the vector nearest to the
   * point (x, y) if the field is defined, otherwise the "nil" vector [NaN, NaN, NIL (-2)] is returned. The method
   * randomize(o) will set {x:, y:} to a random real point somewhere within the field's bounds.
   */
  var createField = function(columns) {
    var nilVector = [NaN, NaN, NIL];
    var field = function(x, y) {
      var column = columns[Math.round(x)];
      if (column) {
        var v = column[Math.round(y) - column[0]]; // the 0th element is the offset--see interpolateColumn
        if (v) {
          return v; // 返回一个插值完成后的插值向量[x轴单位向量，y轴单位向量，长度]
        }
      }
      return nilVector;
    };

    // Create a function that will set a particle to a random location in the field. To do this uniformly and
    // efficiently given the field's sparse data structure, we build a running sum of column widths, starting at 0:
    //     [0, 10, 25, 29, ..., 100]
    // Each value represents the index of the first point in that column, and the last element is the total
    // number of points. Choosing a random point means generating a random number between [0, total), then
    // finding the column that contains this point by doing a binary search on the array. For example, point #27
    // corresponds to w[2] and therefore columns[2]. If columns[2] has the form [1041, a, b, c, d], then point
    // #27's coordinates are {x: 2, y: 1043}, where 1043 == 27 - 25 + 1 + 1041, and the value at that point is 'c'.

    field.randomize = (function() {
      // 存储显示区域内直到当前列结束总共要显示的的点数
      var w = [0];
      for (var i = 1; i <= columns.length; i++) {
        var column = columns[i - 1];
        w[i] = w[i - 1] + (column ? column.length - 1 : 0);
      }
      // 总共点数
      var pointCount = w[w.length - 1];

      return function(o) {
        // 随机点下标
        var p = Math.floor(rand(0, pointCount)); // choose random point index
        // 根据二分法找到随机点所在列
        var x = binarySearch(w, p); // find column that contains this point
        x = x < 0 ? -x - 2 : x; // when negative, x refers to _following_ column, so flip and go back one
        while (!columns[(o.x = x)]) {
          // skip columns that have no points
          x++;
        }
        // use remainder of point index to index into column, then add the column's offset to get actual y
        // 获得随机点实际y轴的位置
        o.y = p - w[x] + 1 + columns[x][0];
        return o;
      };
    })();

    return field;
  };

  /**
   * @param  {} stations
   * @param  {} data
   * @param  {} settings
   * @param  {} masks
   * @description
   * Returns a promise for a vector field function (see createField). The vector field uses the sampling stations'
   * data to interpolate a vector at each point (x, y) in the specified field mask. The vectors produced by this
   * interpolation have the form [dx, dy, m] where dx and dy are the rectangular components of the vector and m is
   * the magnitude dx^2 + dy^2. If the vector is not visible because it lies outside the display mask, then m
   * has the value INVISIBLE (-1).
   */
  var interpolateField = function(masks, data, stations, settings) {
    var d = when.defer();

    if (data.samples.length === 0) {
      return d.reject("暂无数据");
    }
    // 构建EPSG:3857投影下的数据结构[经度,纬度,风速风向向量]
    var points = buildPointsFromSamples(stations, data.samples, settings.projection, function(sample) {
      return isValidSample(sample) ? componentize([sample.wd, sample.wv]) : null;
    });

    if (points.length < 5) {
      return d.reject("数据量偏少");
    }

    // 最近5个点的插值
    var interpolate = mvi.inverseDistanceWeighting(points, 5); // Use the five closest neighbors

    var columns = [];
    // 显示区域是个矩形
    var bounds = settings.displayBounds;
    // 显示蒙版是个行政边界区域
    var displayMask = masks.displayMask;
    // 字段蒙版也是个行政边界区域，但是稍微比显示蒙版多几像素
    var fieldMask = masks.fieldMask;
    // canvas内部x轴方向的区域的结束位置
    var xBound = bounds.x + bounds.width; // upper bound (exclusive)
    // canvas内部y轴方向的区域的结束位置
    var yBound = bounds.y + bounds.height; // upper bound (exclusive)
    var x = bounds.x;

    function interpolateColumn(x) {
      // Find min and max y coordinates in the column where the field mask is defined.
      // fiedMask(x,y) 返回 ture是没被掩盖的，false是被掩盖的， 一旦是true了，说明区域的一块开始要显示了，就是找到了显示区域的边界
      var yMin, yMax;
      for (yMin = 0; yMin < yBound && !fieldMask(x, yMin); yMin++) {}
      for (yMax = yBound - 1; yMax > yMin && !fieldMask(x, yMax); yMax--) {}

      if (yMin <= yMax) {
        // Interpolate a vector for each valid y in the column. A column may have a long empty region at
        // the front. To save space, eliminate this empty region by encoding an offset in the column's 0th
        // element. A column with only three points defined at y=92, 93 and 94, would have an offset of 91
        // and a length of four. The point at y=92 would be column[92 - column[0]] === column[1].

        var column = [];
        var offset = (column[0] = yMin - 1);
        // yMin为该列的显示边界的上边界，yMax为下边界
        for (var y = yMin; y <= yMax; y++) {
          var v = null;
          // 如果该像素点要显示
          if (fieldMask(x, y)) {
            v = [0, 0, 0];
            v = interpolate(x, y, v);
            // 如果显示，则带上长度，否则设为无限长
            v[2] = displayMask(x, y) ? Math.sqrt(v[0] * v[0] + v[1] * v[1]) : INVISIBLE;
            v = mvi.scaleVector(v, settings.velocityScale);
          }
          // column存储的为显示边界的上边界开始的插值向量，所以要减去偏移量
          column[y - offset] = v;
        }
        return column;
      } else {
        return null;
      }
    }

    (function batchInterpolate() {
      try {
        var start = +new Date();
        while (x < xBound) {
          // 对于每个横坐标，都存储着显示区域内插值过后的向量
          columns[x] = interpolateColumn(x);
          x += 1;
          if (+new Date() - start > MAX_TASK_TIME) {
            // Interpolation is taking too long. Schedule the next batch for later and yield.
            //displayStatus("Interpolating: " + x + "/" + xBound);
            setTimeout(batchInterpolate, MIN_SLEEP_TIME);
            return;
          }
        }
        var date = data.date.replace(":00+09:00", "");
        //displayStatus(date + " JST");
        d.resolve(createField(columns));
        //log.timeEnd("interpolating field");
      } catch (e) {
        d.reject(e);
      }
    })();

    return d.promise;
  };

  /**
   * Draws the overlay on top of the map. This process involves building a thin plate spline interpolation from
   * the sample data, then walking the canvas and drawing colored rectangles at each point.
   */

  var drawOverlay = function(masks, stations, data, settings, canvas, view) {
    var recipe = RECIPES["wv"];
    if (!recipe) {
      return when.resolve(null);
    }

    var d = when.defer();

    if (data.samples.length === 0) {
      return d.reject("暂无数据");
    }

    var points = buildPointsFromSamples(stations, data.samples, settings.projection, function(sample) {
      var datum = sample["wv"];
      return datum == +datum ? datum : null;
    });

    if (points.length < 3) {
      // we need at least three samples to interpolate
      return d.reject("数据量偏少");
    }

    var min = recipe.min;
    var max = recipe.max;
    var range = max - min;
    var rigidity = range * 0.05; // use 5% of range as the rigidity

    var interpolate = mvi.thinPlateSpline(points, rigidity);

    var g = canvas.node().getContext("2d");
    var isLogarithmic = recipe.scale === "log";
    var LN101 = Math.log(101);
    var bounds = settings.displayBounds;
    var displayMask = masks.displayMask;
    var xBound = bounds.x + bounds.width; // upper bound (exclusive)
    var yBound = bounds.y + bounds.height; // upper bound (exclusive)
    var x = bounds.x;

    // Draw color scale for reference.
    // 画出图例
    var n = view.width / 5;
    for (var i = n; i >= 0; i--) {
      g.fillStyle = asRainbowColorStyle(1 - i / n, 0.9);
      g.fillRect(view.width - 10 - i, view.height - 20, 1, 10);
    }

    // Draw a column by interpolating a value for each point and painting a 2x2 rectangle
    function drawColumn(x) {
      for (var y = bounds.y; y < yBound; y += 2) {
        if (displayMask(x, y)) {
          // Clamp interpolated z value to the range [min, max].
          // 过滤超出临界值的插值，用临界值代替
          var z = Math.min(Math.max(interpolate(x, y), min), max);
          // Now map to range [0, 1].
          z = (z - min) / range;
          if (isLogarithmic) {
            // Map to logarithmic range [1, 101] then back to [0, 1]. Seems legit.
            z = Math.log(z * 100 + 1) / LN101;
          }
          g.fillStyle = asRainbowColorStyle(z, 0.4);
          g.fillRect(x, y, 2, 2);
        }
      }
    }

    (function batchDraw() {
      try {
        var start = +new Date();
        while (x < xBound) {
          drawColumn(x);
          x += 2;
          if (+new Date() - start > MAX_TASK_TIME) {
            // Drawing is taking too long. Schedule the next batch for later and yield.
            setTimeout(batchDraw, MIN_SLEEP_TIME);
            return;
          }
        }
        d.resolve(interpolate);
      } catch (e) {
        d.reject(e);
      }
    })();

    return d.promise;
  };

  /**
   * @param  {} settings
   * @param  {} field
   * @param  {} canvas
   * Draw particles with the specified vector field. Frame by frame, each particle ages by one and moves according to
   * the vector at its current position. When a particle reaches its max age, reincarnate it at a random location.
   *
   * Per frame, draw each particle as a line from its current position to its next position. The speed of the
   * particle chooses the line style--faster particles are drawn with lighter styles. For performance reasons, group
   * particles of the same style and draw them within one beginPath()-stroke() operation.
   *
   * Before each frame, paint a very faint alpha rectangle over the entire canvas to provide a fade effect on the
   * particles' previously drawn trails.
   */
  var animate = function(settings, field, canvas, map) {
    var bounds = settings.displayBounds;
    // settings.styles 粒子运动轨迹颜色渐变
    var buckets = settings.styles.map(function() {
      return [];
    });
    var particles = [];
    for (var i = 0; i < settings.particleCount; i++) {
      // 对于可显示区域里的点，随机找出paricleCount个点，并对其添加存在时间
      particles.push(field.randomize({ age: rand(0, settings.maxParticleAge) }));
    }

    function evolve() {
      buckets.forEach(function(bucket) {
        bucket.length = 0;
      });
      particles.forEach(function(particle) {
        // 如果粒子存在时间已经大于最大粒子年龄，则重置其年龄
        if (particle.age > settings.maxParticleAge) {
          field.randomize(particle).age = 0;
        }
        var x = particle.x;
        var y = particle.y;
        var v = field(x, y); // 获得该点的向量[x方向单位向量，y方向单位向量，长度] vector at current position
        var m = v[2];
        if (m === NIL) {
          particle.age = settings.maxParticleAge; // particle has escaped the grid, never to return...
        } else {
          // 算出当前粒子运动到下个点的位置
          var xt = x + v[0];
          var yt = y + v[1];
          // 如果当前粒子可见并且下个粒子也可见，则记录下其运动轨迹颜色
          if (m > INVISIBLE && field(xt, yt)[2] > INVISIBLE) {
            // Path from (x,y) to (xt,yt) is visible, so add this particle to the appropriate draw bucket.
            particle.xt = xt;
            particle.yt = yt;
            // 根据粒子长度决定存在于线段中哪个位置
            buckets[settings.styleIndex(m)].push(particle);
          } else {
            // Particle isn't visible, but it still moves through the field.
            // 如果粒子不可见，但是其实还是在运动的，继续记录下它下个点的位置
            particle.x = xt;
            particle.y = yt;
          }
        }
        // 每走一步，粒子存在时间就+1
        particle.age += 1;
      });
    }
    // var g = d3.select(FIELD_CANVAS_ID).node().getContext("2d");
    var g = canvas.node().getContext("2d");
    g.lineWidth = 1.0;
    g.fillStyle = settings.fadeFillStyle;

    function draw() {
      // Fade existing particle trails.
      var prev = g.globalCompositeOperation;
      g.globalCompositeOperation = "destination-in";
      g.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      g.globalCompositeOperation = prev;

      // Draw new particle trails.
      buckets.forEach(function(bucket, i) {
        if (bucket.length > 0) {
          g.beginPath();
          g.strokeStyle = settings.styles[i];
          bucket.forEach(function(particle) {
            // 将(x,y)作为线段起点
            g.moveTo(particle.x, particle.y);
            // 将(xt, yt)作为线段终点画线
            g.lineTo(particle.xt, particle.yt);
            // 粒子位置改变
            particle.x = particle.xt;
            particle.y = particle.yt;
          });
          // 填充颜色
          g.stroke();
        }
      });
    }

    var canceled = false;
    (function frame() {
      try {
        if (!canceled) {
          // var start = +new Date;
          evolve();
          draw();
          // 刷新openlayers, 重新渲染, 因为是作为wind显示区域其实是一张图，某个瞬间的canvas的一张图
          map.render();
          // var duration = (+new Date - start);
          // 根据帧率不停画运动轨迹
          setTimeout(frame, settings.frameRate /* - duration*/);
        }
      } catch (e) {
        // report(e);
      }
    })();

    settings.stopAnimation = function cancel() {
      canceled = true;
    };
  };

  var loadJson = function(resource) {
    var d = when.defer();
    d3.json(resource, function(error, result) {
      return error
        ? !error.status
          ? d.reject({
              error: -1,
              message: "无法加载资源: " + resource,
              resource: resource
            })
          : d.reject({
              error: error.status,
              message: error.statusText,
              resource: resource
            })
        : d.resolve(result);
    });
    return d.promise;
  };

  /**
   * @param  {array} data
   * @description 预处理数据点
   */
  var prepareData = function(data) {
    return data || { date: undefined, samples: [] };
  };

  /**
   * @param  {array} rows
   * @description 预处理站点
   */
  var prepareStations = function(rows) {
    var stations = {};
    rows.forEach(function(row) {
      var stationId = row[0];
      stations[stationId.toString()] = {
        stationId: stationId,
        name: row[1], // 站点名
        address: row[2],
        coordinates: [row[3], row[4]] // 经度，纬度
      };
    });
    return stations;
  };

  var getProjection = function(topo, data, stations, extent, resolution, pixelRatio, size, projection, canvas) {
    var features = topojson.feature(topo, topo.objects.counties);
    var canvasWidth = size[0];
    var canvasHeight = size[1];

    canvas.attr("width", canvasWidth).attr("height", canvasHeight);

    var context = canvas.node().getContext("2d");

    var d3Projection = d3.geo
      .mercator()
      .scale(1)
      .translate([0, 0]);
    var d3Path = d3.geo.path().projection(d3Projection);

    var pixelBounds = d3Path.bounds(features);
    var pixelBoundsWidth = pixelBounds[1][0] - pixelBounds[0][0];
    var pixelBoundsHeight = pixelBounds[1][1] - pixelBounds[0][1];

    var geoBounds = d3.geo.bounds(features);
    var geoBoundsLeftBottom = ol.proj.transform(geoBounds[0], SOURCE_PROJECTION, projection);
    var geoBoundsRightTop = ol.proj.transform(geoBounds[1], SOURCE_PROJECTION, projection);
    var geoBoundsWidth = geoBoundsRightTop[0] - geoBoundsLeftBottom[0];
    if (geoBoundsWidth < 0) {
      geoBoundsWidth += ol.extent.getWidth(projection.getExtent());
    }
    var geoBoundsHeight = geoBoundsRightTop[1] - geoBoundsLeftBottom[1];

    var widthResolution = geoBoundsWidth / pixelBoundsWidth;
    var heightResolution = geoBoundsHeight / pixelBoundsHeight;
    var r = Math.max(widthResolution, heightResolution);
    var scale = r / (resolution / pixelRatio);

    var center = ol.proj.transform(ol.extent.getCenter(extent), projection, SOURCE_PROJECTION);
    d3Projection
      .scale(scale)
      .center(center)
      .translate([canvasWidth / 2, canvasHeight / 2]);

    d3Path = d3Path.projection(d3Projection).context(context);
    d3Path(features);
    context.stroke();

    return d3Projection;
  };

  // 将接力执行下个任务函数
  var deliver = function(task, externalArgs) {
    externalArgs = externalArgs || [];
    // 下面的匿名函数是when then的callback函数
    return function(args) {
      return task.apply(null, args.concat(externalArgs));
    };
  };

  var init = function(topoUrl, dataUrl, stationsUrl, map) {
    var getTopo = loadJson(topoUrl);
    var getData = loadJson(dataUrl);
    var getStations = loadJson(stationsUrl);
    var getDataTask = when.all([getData]).then(deliver(prepareData));
    var getStationsTask = when.all([getStations]).then(deliver(prepareStations));

    var canvasFunctions = {
      particle: function(extent, resolution, pixelRatio, size, projection) {
        var view = {
          width: size[0],
          height: size[1]
        };
        var canvas = d3.select(document.createElement("canvas"));
        var getProjectionTask = when.all([getTopo, getDataTask, getStationsTask]).then(deliver(getProjection, [extent, resolution, pixelRatio, size, projection, canvas]));
        var createSettingsTask = when.all([getTopo, getProjectionTask]).then(deliver(createSettings, [view]));
        var buildMeshesTask = when.all([getTopo, createSettingsTask]).then(deliver(buildMeshes));
        var renderTask = when.all([createSettingsTask, buildMeshesTask]).then(deliver(render, [view]));
        var interpolateFieldTask = when.all([renderTask, getDataTask, getStationsTask, createSettingsTask]).then(deliver(interpolateField));
        var animateTask = when.all([createSettingsTask, interpolateFieldTask]).then(deliver(animate, [canvas, map]));

        return canvas.node();
      },
      contour: function(extent, resolution, pixelRatio, size, projection) {
        var view = {
          width: size[0],
          height: size[1]
        };
        var canvas = d3.select(document.createElement("canvas"));
        var getProjectionTask = when.all([getTopo, getDataTask, getStationsTask]).then(deliver(getProjection, [extent, resolution, pixelRatio, size, projection, canvas]));
        var createSettingsTask = when.all([getTopo, getProjectionTask]).then(deliver(createSettings, [view]));
        var buildMeshesTask = when.all([getTopo, createSettingsTask]).then(deliver(buildMeshes));
        var renderTask = when.all([createSettingsTask, buildMeshesTask]).then(deliver(render, [view]));
        var drawOverlayTask = when.all([renderTask, getStationsTask, getDataTask, createSettingsTask]).then(deliver(drawOverlay, [canvas, view]));

        return canvas.node();
      }
    };

    return canvasFunctions;
  };

  return {
    init: init
  };
});
