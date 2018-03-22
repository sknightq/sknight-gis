;(function(root, factory) {
  "use strict"
  if (typeof define === "function" && define.amd) {
    // AMD
    define(["jquery", "moment", "ionRangeSlider"], factory)
  } else if (typeof exports === "object") {
    // Node, CommonJS之类的
    module.exports = factory(require("jquery", "moment", "ionRangeSlider"))
  } else {
    // 浏览器全局变量(root 即 window)
    // 普通 挂载到window对象上
    var $ = root.Zepto || root.jQuery
    root.mapWind = factory($, root.moment, root.ionRangeSlider)
  }
})(this, function($, moment, ionRangeSlider) {
  "use strict"
  function SlidePlay(element, settings, map) {
    this.instanceId = 0

    // 默认参数
    this.defaults = {
      id: "contour",
      extend: [
        121.3780903816224,
        29.739330799041529,
        121.7403817176816,
        30.036409694610072
      ],
      size: [1000, 820],
      dataPath: "../images/",
      imagePath: "../images",
      interval: 1000,
      asc: true,
      autoReplay: true,
      data: []
    }
    this.map = map
    // 合并用户设定参数和默认参数，如果不用深拷贝可以第一个参数不传
    this.options = $.extend(true, {}, this.defaults, settings)
    // 实例化的所绑定DOM对象
    this.$element = $(element)
    // 实例化后播放条绑定的DOM对象
    this.$slide = null
    // 实例化后播放图片绑定的DOM对象
    this.$gallery = null
    // 播放条实例化对象
    this.slidePlay = null
    // 存储处理后的数据
    this.storeData = []
    // 当前播放的索引
    this.index = 0
    // 数据长度
    this.len = this.options.data.length
    // 计时器
    this.timer = null
    // 插件初始化
    this.init(this.options)
    // 插件事件绑定
    this.initEvent(this.options)
  }

  SlidePlay.prototype = {
    init: function() {
      var self = this
      // do something
      $(self.options.data).each(function(i, item) {
        self.options.data[i].timeStamp = moment(
          item.time,
          "YYYY-MM-DD HH:mm:ss"
        ).unix()
        self.storeData.push(self.options.data[i].timeStamp)
      })

      // 以防万一，前端这里重新递增排序
      self.options.data = self.options.data.sort(function compare(a, b) {
        return parseInt(a.timeStamp, 10) - parseInt(b.timeStamp, 10)
      })

      self.storeData = self.storeData.sort(function compare(a, b) {
        return parseInt(a, 10) - parseInt(b, 10)
      })

      self.initControls()
      self.initRangeSlide()
      self.initGallery()
      self.instanceId++
    },
    initControls: function() {
      var self = this
      var controlsHtml =
        '<div class="controls-btns pull-left">' +
        '<a href="javascript:;" class="circle-btn backward-btn">' +
        '<img src="' +
        self.options.imagePath +
        'btn_backward.png" alt="前一个" />' +
        "</a>" +
        '<a href="javascript:;" class="circle-btn play-btn">' +
        '<img src="' +
        self.options.imagePath +
        'btn_play.png" alt="开始" />' +
        "</a>" +
        '<a href="javascript:;" class="circle-btn pause-btn hide">' +
        '<img src="' +
        self.options.imagePath +
        'btn_pause.png" alt="暂停" />' +
        "</a>" +
        '<a href="javascript:;" class="circle-btn forward-btn">' +
        '<img src="' +
        self.options.imagePath +
        'btn_forward.png" alt="后一个" />' +
        "</a>" +
        "</div>"
      self.$element.append(controlsHtml)
    },
    initRangeSlide: function() {
      var self = this
      var op = self.options

      self.$element.append(
        '<div class="slide-wrapper"><input type="text" class="slide" name="slide-' +
          self.instanceId +
          '" value=""></div>'
      )
      self.$slide = self.$element.find(".slide")
      self.$slide.ionRangeSlider({
        min: moment()
          .startOf("day")
          .format("X"),
        max: moment()
          .endOf("day")
          .format("X"),
        from: moment()
          .startOf("day")
          .format("X"),
        grid: true,
        force_edges: true,
        prettify: function(num) {
          var m = moment(num, "X")
          return m.format("YYYY MM DD A HH:mm:ss")
        }
      })

      self.slidePlay = self.$slide.data("ionRangeSlider")

      if (op.data && op.data.length) {
        self.updateSlideRange(op.data)
      }
    },
    initGallery: function() {
      var self = this
      var op = self.options

      if (op.data && op.data.length) {
        self.updateGallery(op.data)
      }
    },
    initEvent: function() {
      var self = this
      $(".play-btn", self.$element).on("click", function() {
        $(this).addClass("hide")
        $(".pause-btn", self.$element).removeClass("hide")

        if (self.index == self.len - 1) {
          self.index = 0
        }

        if (self.timer) {
          clearInterval(self.timer)
        }

        self.timer = setInterval(function() {
          // 是否顺序播放
          if (self.options.asc) {
            //$('.gallery-item', self.$element).eq(self.index).show().siblings().hide();
            self.updateLayer(self.index)
          } else {
            //$('.gallery-item', self.$element).eq(self.len - 1 - self.index).show().siblings().hide();
            self.updateLayer(self.len - 1 - self.index)
          }
          self.slidePlay.update({
            from: self.options.data[self.index++].timeStamp
          })

          if (self.index == self.len && self.timer) {
            self.index = 0
            // 是否设置了自动重播
            if (!self.options.autoReplay) {
              clearInterval(self.timer)
              $(".pause-btn", self.$element).addClass("hide")
              $(".play-btn", self.$element).removeClass("hide")
            }
          }
        }, self.options.interval)
      })

      $(".forward-btn", self.$element).on("click", function() {
        if (self.index + 1 < self.len) {
          self.index = self.index + 1
          self.slidePlay.update({
            from: self.options.data[self.index].timeStamp
          })
          // 是否顺序播放
          if (self.options.asc) {
            self.updateLayer(self.index)
          } else {
            self.updateLayer(self.len - 1 - self.index)
          }
        }
      })

      $(".backward-btn", self.$element).on("click", function() {
        if (self.index - 1 >= 0) {
          self.index = self.index - 1
          self.slidePlay.update({
            from: self.options.data[self.index].timeStamp
          })
          // 是否顺序播放
          if (self.options.asc) {
            self.updateLayer(self.index)
          } else {
            self.updateLayer(self.len - 1 - self.index)
          }
        }
      })

      $(".pause-btn", self.$element).on("click", function() {
        if (self.timer) {
          clearInterval(self.timer)
        }
        $(this).addClass("hide")
        $(".play-btn", self.$element).removeClass("hide")
      })
    },

    update: function(data) {
      var self = this
      self.updateSlideRange(data)
      self.updateGallery(data)
    },

    updateSlideRange: function(data) {
      var self = this

      self.slidePlay.update({
        min: data[0].timeStamp,
        max: data[self.len - 1].timeStamp,
        from: data[0].timeStamp,
        grid: true,
        force_edges: false,
        prettify: function(num) {
          // 如果是倒序播放
          if (!self.options.asc) {
            num = data[self.len - 1].timeStamp + data[0].timeStamp - num
          }
          var m = moment(num, "X")
          return m.format("YYYY MM DD HH:mm:ss")
        },
        onStart: function(data) {
          //console.log("onStart");
        },
        onChange: function(data) {
          //console.log("onChange");
        },
        onFinish: function(data) {
          //console.log(data);
          var oldfrom = data.from
          var newFrom = self.storeData[0]
          for (var i = 1; i < self.len; i++) {
            if (oldfrom < self.storeData[i]) {
              if (
                self.storeData[i] - oldfrom <=
                oldfrom - self.storeData[i - 1]
              ) {
                newFrom = self.storeData[i]
                self.index = i
              } else {
                newFrom = self.storeData[i - 1]
                self.index = i - 1
              }
              break
            } else {
              continue
            }
          }
          self.slidePlay.update({
            from: newFrom
          })
          if (self.index >= 0) {
            self.updateLayer(self.index)
          }
        },
        onUpdate: function(data) {
          //console.log(data);
          if (self.index == self.len) {
            //clearInterval(timer);
            //$('.play-btn', self.$element).removeClass('hide');
            //$('.pause-btn', self.$element).addClass('hide');
          }
        }
      })
    },
    updateLayer: function(currentIndex) {
      var self = this
      for (var i = 0; i < self.len; i++) {
        if (i == currentIndex) {
          self.map.toggleLayerVisible(self.options.id + "-" + i, true)
        } else {
          self.map.toggleLayerVisible(self.options.id + "-" + i, false)
        }
      }
    },
    updateGallery: function(data) {
      var self = this
      var visible = false
      var start = 0
      if (!self.options.asc) {
        start = self.len - 1
      }

      $(data).each(function(i, item) {
        if (i !== start) {
          visible = false
        } else {
          visible = true
        }
        self.map.addContourImg(
          self.options.dataPath + item.fileName,
          self.options.id + "-" + i,
          self.options.extend,
          self.options.size,
          visible
        )
      })
    },

    destroy: function() {
      var self = this
      clearInterval(self.timer)
      $(".play-btn", self.$element).off("click")
      $(".pause-btn", self.$element).off("click")
      $(".forward-btn", self.$element).off("click")
      $(".backward-btn", self.$element).off("click")
      self.slidePlay.destroy()
      self.$element.empty()
    }
  }

  $.fn.slidePlay = function() {
    var self = this,
      opt = arguments[0],
      // 获取从第二个位置起的全部参数
      args = Array.prototype.slice.call(arguments, 1),
      ret
    for (var i = 0; i < self.length; i++) {
      // 如果参数是对象或者未定义则初始化
      if (typeof opt == "object" || typeof opt == "undefined") {
        self[i].slidePlay = new SlidePlay(self[i], opt, arguments[1])
        // 如果参数是方法名字符串则执行方法
      } else {
        ret = self[i].slidePlay[opt].apply(self[i].slidePlay, args)
      }
      if (typeof ret != "undefined") {
        return ret
      }
    }
    return self
  }
})
