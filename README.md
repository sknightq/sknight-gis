# Sknight-GIS  
> 代码维护 sknigt 
> 当前版本 v0.3.0  
> 兼容性 IE9+ chrome（IE9下需要打2个JS补丁，截图功能只能在高版本浏览器中实现）  
> todo 将D3升级到V4或者V5版本, 目前wind相关的DEMO请看d3.v3-map.html  
> 感谢[Cameron Beccario](https://github.com/cambecc/air) 代码分享

## 1.版本  
### v0.3.0  
* 将wind init渲染方式改了为了Promise形式  

### v0.2.9  
* 根据实际项目需求修改了addPopover方法  
* 根据实际项目需求新增了getLayerFeatures，removeLayerFeatures方法  

### v0.2.8  
* 修改设置feature id的代码  
* 新增获取图层（vector类型）上 feature功能  

### v0.2.7  
* 对renderLayer方法内部进行了修改，增加了GIS图层上可添加几何图形的配置  

### v0.2.6
* 修正wind组件全局引入方式的错误代码，并修改了代码内部处理json经纬度的位置  
* 增加了when.global.js作为全局引入方式  
* 增加了等值线图播放的组件  

### v0.2.5  
* 修改了风向风速组件里，所需数据处理时经纬度位置进行了互换，要求为[经度, 纬度] 
* 修改默认底图的配置结构  
* 修改了boundary可以添加多个边界geojson数据  
* 修改selectend事件返回的要素结构，原来只会返回某一图层的要素，现在返回所有图层（ol.source.Vector类型图层）的所有要素  
* 修改stationHover事件返回的参数，新增了$content和layerName  
* 修改connectLine参数位置  
* 修改addContourImg参数，新增图层名name和图片size参数  
* 实例化时新增basePath参数，可调整插件所要引用的图片和json数据的路径  
* 修改图层参数中图片配置逻辑，对circle类型的图片新增了默认配置  
* 修改图层参数中预留了geometry参数  
* 新增图层参数中单位配置，对于个别要素需要显示单位的可直接渲染到gis中  
* 新增modifyFeatureValue的参数，新增unit参数，对于个别要素需要显示单位的可直接渲染到gis中  

### v0.2.0
* 增加风向风速组件，用于canvas上渲染动态风，数据结构和使用说明在进一步整理中  

### v0.1.8
* 设置默认站点图标位置为底部中心点位置，实际使用过程中根据图标形状决定。 默认:anchor:[0.5 1]  

### v0.1.7  
* 增加图层文字对齐功能（'left','center','right'）  

### v0.1.6
* 增加截取当前地图的功能  

### v0.1.5  
* 修改默认底图只有基础底图，其他（街道图和卫星图）设为空， 当大于一个图层时会出现图层切换按钮  

### v0.1.4  
* 将回归中心点功能作为ol.control里的自定义功能封装到control代码块中，取代之前用额外html生成按钮方式，原方式在GIS全屏中按钮会消失（考虑其他辅助功能也用此类似方式嵌入进去）  

### v0.1.3  
* 修改站点点击事件依赖弹窗参数的错误，并修改回归中心点方法中放大级别作为可选项传参（原本是必选项），以及增加动画效果  

### v0.1.2  
* 完全修正坐标点是否在一几何图形内的判断（原本是用extent判断，始终是矩形）  

### v0.1.1  
* 增加stationClick事件，用于获取站点相关信息来弹窗  

### v0.1.0
* 增加可渲染经纬网格线的方法 renderGraticule  

## 2.运行环境  
IE9+  
  
## 3.起步  
代码下载  
 `git clone https://github.com/sknightq/sknight-gis.git`  
进入文件夹  
`cd sknight-gis`  
依赖库下载安装  
`npm install`  
启动Demo服务  
`http-server`    

## 4.初始化
1.实例化地图  

`var map = sntMap(gisOptions, basePath);`  

## 5.参数配置  

### 地图参数 gisOptions
| option       | type       | description  |
| -------------|-------------|-------------|
|target|object|js DOM对象，地图渲染容器|
|layers.baseMap.basic| string| 基础底图的url路径（xyz方式的瓦片图）|
|layers.baseMap.street| string| 街道底图的url路径（xyz方式的瓦片图）|
|layers.baseMap.statellite| string| 卫星底图的url路径（xyz方式的瓦片图）|
|layers.baseMap.crossOrigin| null,string | 底图是否跨域（null或者Anonymous）|
|boundary.enable| boolen| 是否开启行政边界|
|boundary.name| string|行政边界layer名称，用于获取行政边界图层时的索引名|
|boundary.url| string| 行政边界请求的geoJson，用于渲染行政边界|
|station.enable| boolen| 是否开启以json文件形式去获取站点|
|station.name|string|站点layer名称，用于获取站点图层时的索引名|
|station.url| string| 站点请求的geoJson，用于渲染站点|
|view.center| array | 以数组形式给定个坐标点，用于初始化时地图显示的位置[精度，纬度]，
|view.rotation| number|地图初始化时的旋转角度|
|view.zoom| number|地图初始化时的放大级别|
|view.minZoom| number|地图最小放大级别|
|view.maxZoom| number|地图最大放大级别|
|controls.fullscreen| boolen| 是否开启全屏功能，在iframe里要设置iframe可以全屏属性|
|controls.overviewMap| boolen|是否开启鹰眼缩略图功能|
|tools.popup| boolen|是否开启弹框功能|
|tools.draw|boolen|是否开启地图上画图功能|
|tools.switchBaseMap|boolen| 是否开启切换底图功能|
|tools.mousePosition|boolen|是否开启鼠标选取坐标点功能|
|extent.bound|array|地图拖动限制区域，内含2个数组，分别为[最小经度，最小纬度]，[最大经度，最大纬度]|
### 地图参数 basePath  
| option       | type       | description  |  
| -------------|-------------|-------------|  
|basePath|string|插件基础路径，内部部分图标，数据需要这个路径|  

    var map = sntMap(gisOptions, basePath);

    {
        target: document.getElementById('map'), // 地图html容器
        layers: { // 地图地图配置参数
            /*
            baseMap: [{
                    label: '基础底图',
                    url:'https://api.mapbox.com/styles/v1/sknight/cizhzho3x000d2skf0uqrp088/tiles/256/{z}/{x}/{y}' + access_token,
                    layerName: 'basic',
                },
                {
                    label: '街道底图',
                    url:'https://api.mapbox.com/styles/v1/sknight/ciy13vljr004f2so6gd293aaz/tiles/256/{z}/{x}/{y}' + access_token,
                    layerName: 'street',
                }, {
                    label: '卫星底图',
                    url:'https://api.mapbox.com/styles/v1/sknight/cizhzfx9z000g2spapja22psw/tiles/256/{z}/{x}/{y}' + access_token,
                    layerName: 'satellite',
                }
            ],
            */
            boundary: { // 地图行政边界
                enable: true,
                items: [{ // 可以以多个对象形式添加多个行政
                    name: 'boundary',
                    url: './data/boundary-nb.json',
                }]
            },
            station: { // 地图站点图层
                enable: false, // 是否显示地图站点图层
                name: 'stations',
                url: 'data/stations.json',
            }
        },
        view: { // 地图显示参数
            center: [-472202, 7530279], // 初始化地图的中心点,以该点为中心显示
            rotation: Math.PI / 6, // 地图以平面展示
            zoom: 12, // 初始化缩放比例
            minZoom:11, // 设置最小缩放比例
            maxZoom: 20 // 设置最大缩放比例
        },
        controls: {
            fullScreen: false, // 是否开启全屏功能
            overviewMap: false, // 是否开启鹰眼功能
        },
        tools: {
            popup: false, // 弹出框
            draw: false, // 绘图功能
            switchBaseMap: false, //底图切换
            mousePosition: false
        },
        extent: {
            bound: [],
        }
    }

### 图层样式

| option       | type       | description  |
| -------------|-------------|-------------|
| pointName| string| 字段名，根据此字段名，会从geoJson里获取站点名字|
| pointId|string| 字段名，根据此字段名，会从geoJson里获取站点编号|
| pointValue| string|字段名，根据此字段名，会从geoJson里获取站点值|
| pointType| string| 站点渲染方式，目前有point和polygon两种|
| image.anchor| array| 图标的哪个点作为坐标点，默认[0.5 1],图标的底部中心位置|
| image.enable| boolen| 地图上是否显示该站点图标|
| image.opacity| number| 图标透明度，取值[0,1]|
| image.offset| array| 图片偏移，在size设定的大小里图片进行偏移，原理类似css background|
| image.size| array| 图标尺寸|
| image.scale| number| 图标放大倍数，取值[0,1]|
| image.srcType| string | 图片源类型，有all和single两种<br>all:代表站点图标（type=icon）或者站点填充色（type=circle）一致，那么图片路径（图片填充色）会根据src（fillColor和strokeColor）来渲染；<br>single:代表站点图标type=icon）或者站点填充色（type=circle）各不相同，那么图片路径（图片填充色）会从geoJson中properties属性里的imgSrc（fillColorKey,strokeColorkey,strokeWidthKey）来渲染|
| image.src| string| 当image.srcType = all时的图标路径|
| image.radius| number| 当图标为circel时的半径|
| image.type| string| 图标类型，一种是circle，用canvas画出的圆形，一种是icon，用图片|
| image.fill.color| string| 当图标类型是circle时，图标填充色|
| image.stroke.color| string| 当图标类型是circle时，图标边缘色|
| image.stroke.width| number| 当图标类型是circle时，图标边缘宽度|
| text.enable| boolen| 地图上是否显示该站点文字信息（例如值，站点名，要素名称等等）|
| text.font| string| 字体大小和字体名称，默认是“10px 微软雅黑”|
| text.text| string| 字段名，站点显示的文字，默认是用站点名|
| text.textAlign| string|文字对齐方式:'center', 'left', 'right'|
| text.scale| number| 字体放大倍数，取值[0,1]|
| text.offsetX| number| 字体X轴方向的偏移|
| text.offsetY| number| 字体y轴方向的偏移|
| text.fill.color| string| 字体填充色|
| text.stroke.color| string| 字体边缘色|
| text.stroke.width| number| 字体边缘宽度|
| geometry.enable| boolen| 是否用几何图形|
| geometry.styleType| string|  几何图形样式类型，是统一一样的，还是每个站点不一样， 有single和all两个可选参数|
| geometry.fill.color|string|填充颜色|
| geometry.stroke.color|string|边缘颜色|
| geometry.stroke.width|number|边缘宽度|
| geometry.edgeNum| number| 正多边形边数|
| geometry.edgeLen| number| 正多边形边长|
| visible| boolen| 初始化时站点是否可见|
| popupable| boolen| 站点图层是否可点击|
| unit| string| 在图层上要素值后面要加单位的话|


## 8.方法  

| method        | param           | description  | demo|
| ------------- |-------------|-------------| -----|
|setViewCenter(coordinate, zoom)  | coordinate:包含经度纬度的数组[long, lat]<br>zoom:缩放比例 | 设定地图中心点 |map.setViewCenter([121.93667, 29.8075],10);|
| renderLayer(points, name, customOpt)   | points:数组类型<br> name:string<br>customOpt:图层自定义样式  |  渲染图层（多个图层可拼凑一个站点信息）  |map.renderLayer(data, 'station', stationOpt);|
| togglePointVisible(layersName, visible) | layersName:string类型,图层名称<br>visible:boolen,站点是否显示|  切换站点隐藏显示 |map.togglePointVisible('station', false);|
| toggleLayerVisible(layerName, visible) | layersName:string类型,图层名称<br>visible:boolen,图层是否可见[可选参数]不传直接取反当前状态     |  切换layer层隐藏显示 |map.toggleLayerVisible('station', false);|
| removeLayers(layerNames) | layersName:string类型,需要移除的图层名    |  移除指定图层 |map.removeLayers('station');|
| hideNoDataPoint(layerName, key, noValue) | layerName:string类型,隐藏的图层名<br>key:字段名称，根据此字段来隐藏无数据的点<br>noValue:string|null，何种值情况下作为无数据，例如：null, '', '无' | 隐藏没有数据的图层 |map.hideNoDataPoint('station','station_name');|
| addContourImg(url, name, extent, size, visible) | url:string类型,图片地址<br> name:string layer图层名<br>extent:数组类型,图片最小经纬度和最大经纬的值<br>size array <br>visible:boolen类型,初始化状态是否可见    | 增加一个以静态图片展现的等值线图层 |map.addContourImg('url',extent,visible);|
| clearSource(layerNames) | layerName:string类型,要清空的图层名  | 清空指定图层source |map.clearSource('station');|
|modifyFeatureValue(feature, value, operation, unit)| feature:object 站点feature<br> value:number，要处理的值<br>operation:string，要操作的方式，有add(加),minus(减),replace(替换)<br> unit 如果值需要单位，不需要就传空字符|修改指定要素的显示值|map.modifyFeatureValue(feature, '1', 'add', '℃')

## 事件  

* 1.图层点击(click)事件  

        $('#map').on('stationClick',function(e, stationInfo, coordinates, layerName, featureStyle){
            // stationInfo, 站点信息，geoJson中proproties传入的参数都会被返回回来
            // coordintes, 站点坐标
            // layerName, 点击所属的图层名称
            // featureStyle,  所点击站点的feature样式
        });  
* 2.图层悬停(hover)事件  

        $('#map').on('stationHover', function(e, stationInfo, overlay, $content, layerName, coordinates) {
            stationInfo, 站点信息，geoJson中proproties传入的参数都会被返回回来
            overlay, openlayer的弹出图层
            $content, 弹出图层内部选择器，可以用这个插入html
            layerName, 点击所属的图层名称
            coordinates, 站点坐标
        });

* 3.画图交互事件  

        $('#map').on('selectend', function(e, features){
            //feautes, 选中的除底图外所有图层上的要素
            // 以对象形式返回，每个键名都是所添加图层的图层名
            // 例如：
            /*
            features = {
                'boundary':[],
                'station':[],
                'wind':[]
                ....
            }
            */
        });
