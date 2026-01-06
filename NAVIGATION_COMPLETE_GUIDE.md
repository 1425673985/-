# 小程序内导航功能完整实现指南

## 功能概述

实现完全在小程序内的步行导航功能，**不跳转到腾讯地图小程序**，**不出现系统确认弹窗**。

## 技术方案

### 1. 路线规划 API

**使用服务**：腾讯地图 WebService API - Direction 接口  
**API 文档**：https://lbs.qq.com/service/webService/webServiceGuide/webServiceRoute  
**接口地址**：`https://apis.map.qq.com/ws/direction/v1/walking/`

**请求参数**：
- `key`: 腾讯地图 API Key
- `from`: 起点坐标（格式：`纬度,经度`）
- `to`: 终点坐标（格式：`纬度,经度`）
- `output`: 返回格式（`json`）

**返回数据**：
```json
{
  "status": 0,
  "result": {
    "routes": [{
      "distance": 428,        // 总距离（米）
      "duration": 360,         // 总时间（秒）
      "polyline": "...",       // 压缩的坐标点字符串
      "steps": [...]           // 路线步骤数组
    }]
  }
}
```

### 2. Polyline 解码

腾讯地图返回的 `polyline` 是**压缩格式**（Google Polyline Encoding），需要解码为坐标点数组。

**解码算法**：已在 `utils/routePlan.js` 中实现 `decodePolyline()` 函数。

**解码后的格式**：
```javascript
[
  { latitude: 39.916527, longitude: 116.397128 },
  { latitude: 39.916600, longitude: 116.397200 },
  ...
]
```

### 3. 地图组件配置

**WXML 结构**：
```xml
<map
  id="map"
  longitude="{{longitude}}"
  latitude="{{latitude}}"
  scale="{{scale}}"
  markers="{{markers}}"
  polyline="{{polyline}}"
  show-location="{{showLocation}}"
  enable-poi="{{false}}"
  enable-building="{{false}}"
  enable-scroll="{{true}}"
  enable-zoom="{{true}}"
></map>
```

**关键属性**：
- `markers`: 标记点数组（用户位置 + 厕所位置）
- `polyline`: 路线 polyline 数组（绘制路线）
- `show-location`: 显示原生蓝色定位圆点（用户位置）

### 4. Markers 配置

**导航模式下显示两个 marker**：

1. **用户位置**（ID: 9999）
   - 蓝色圆点
   - 显示"我的位置"标签（点击时显示）

2. **厕所位置**（ID: 8888）
   - 红色高亮标记
   - 显示厕所名称（始终显示）

**代码示例**：
```javascript
const markers = [
  {
    id: 9999,
    longitude: userLocation.longitude,
    latitude: userLocation.latitude,
    width: 40,
    height: 40,
    callout: { content: '我的位置', display: 'BYCLICK' }
  },
  {
    id: 8888,
    longitude: toilet.longitude,
    latitude: toilet.latitude,
    width: 80,
    height: 80,
    callout: { content: toilet.title, display: 'ALWAYS' }
  }
]
```

### 5. Polyline 配置

**格式**：
```javascript
polyline: [{
  points: [{latitude, longitude}, ...], // 坐标点数组
  color: '#FF6B6B',      // 路线颜色（红色）
  width: 6,              // 路线宽度
  arrowLine: true,       // 显示方向箭头
  borderColor: '#FFFFFF', // 边框颜色
  borderWidth: 2         // 边框宽度
}]
```

## 完整代码结构

### 1. 工具文件：`utils/routePlan.js`

```javascript
// 获取步行路线
getWalkingRoute(from, to)

// 解码 polyline
decodePolyline(polyline)

// 格式化路线步骤
formatRouteSteps(steps)
```

### 2. 页面 JS：`pages/index/index.js`

**Data 结构**：
```javascript
data: {
  // 导航相关
  isNavigating: false,        // 是否处于导航模式
  polyline: [],                // 路线 polyline 数据
  routeSteps: [],              // 路线步骤指引
  routeDistance: 0,            // 路线总距离（米）
  routeDuration: 0,           // 路线总时间（秒）
  routeDistanceText: '',       // 显示用的总距离文案
  routeDurationText: ''       // 显示用的总时间文案
}
```

**核心方法**：
```javascript
// 导航到厕所（小程序内导航）
navigateToToilet()

// 更新导航模式下的 markers
updateMarkersForNavigation(userLocation, toilet)

// 退出导航模式
exitNavigation()

// 调整地图视图以显示完整路线
adjustMapToShowRoute(points, userLocation, toilet)
```

### 3. 页面 WXML：`pages/index/index.wxml`

**地图组件**：
```xml
<map
  id="map"
  markers="{{markers}}"
  polyline="{{polyline}}"
  show-location="{{showLocation}}"
></map>
```

**导航指引卡片**：
```xml
<view class="navigation-guide" wx:if="{{isNavigating && routeSteps.length > 0}}">
  <view class="navigation-stats">
    <text>总距离：{{routeDistanceText}}</text>
    <text>预计时间：{{routeDurationText}}</text>
  </view>
  <scroll-view class="navigation-steps">
    <view wx:for="{{routeSteps}}">
      <text>{{item.instruction}}</text>
      <text>{{item.distance}}</text>
    </view>
  </scroll-view>
</view>
```

## 配置步骤

### 第一步：申请腾讯地图 API Key

1. 访问：https://lbs.qq.com/
2. 注册/登录账号
3. 创建应用，获取 **Key（密钥）**
4. 在 `utils/routePlan.js` 第 11 行替换：
   ```javascript
   const TENCENT_MAP_KEY = '你的腾讯地图 Key'
   ```

### 第二步：配置域名白名单

**生产环境**（必须配置）：
1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 **开发 > 开发管理 > 开发设置**
3. 在 **服务器域名** 中添加：
   - **request 合法域名**：`https://apis.map.qq.com`

**开发阶段**（本地调试）：
- 在微信开发者工具中：**详情 > 本地设置 > 不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书**
- 勾选此选项，可跳过域名校验

## 微信小程序限制

### 1. 域名白名单限制
- **必须配置** `apis.map.qq.com` 为合法域名
- 开发阶段可勾选"不校验合法域名"进行调试
- 生产环境必须配置，否则无法调用 API

### 2. API 调用频率限制
- 腾讯地图 WebService API 有调用频率限制
- **建议**：缓存路线数据，避免重复请求相同起终点的路线

### 3. Polyline 性能限制
- 路线点过多可能影响地图性能
- **建议**：路线点超过 1000 个时进行抽稀处理
- 当前实现已自动处理，无需手动优化

### 4. 地图组件限制
- `<map />` 组件不支持实时定位更新
- 如需实时导航，需要定期调用 `wx.getLocation()` 更新位置
- 当前实现为静态路线展示，不包含实时导航

### 5. WXML 表达式限制
- WXML 中不能使用复杂 JavaScript 表达式（如 `.toFixed()`, `Math.ceil()`）
- **解决方案**：在 JS 中预先计算好展示文案，WXML 中直接绑定

## 体验优化建议

### 1. 路线缓存
```javascript
// 缓存相同起终点的路线
const cacheKey = `${from.lat},${from.lng}-${to.lat},${to.lng}`
if (routeCache[cacheKey]) {
  return Promise.resolve(routeCache[cacheKey])
}
```

### 2. 加载状态
- 路线规划时显示"正在规划路线..."加载提示
- 使用 `wx.showLoading()` 和 `wx.hideLoading()`

### 3. 错误处理
- API 调用失败时显示友好提示
- 网络错误时提示用户检查网络

### 4. 地图视图优化
- 自动调整地图缩放级别，确保路线完整可见
- 计算路线边界，自动居中显示

### 5. 路线指引优化
- 路线步骤按顺序显示
- 每个步骤显示距离和文字指引
- 使用滚动列表，支持长路线

## 功能特性

✅ **无跳转**：完全在小程序内完成导航  
✅ **无弹窗**：不会触发"即将打开小程序"确认  
✅ **路线显示**：地图上绘制红色路线，带方向箭头  
✅ **文字指引**：提供详细的路线步骤和距离  
✅ **自动适配**：地图自动调整视图，显示完整路线  
✅ **双标记**：同时显示用户位置和厕所位置  

## 测试步骤

1. **配置 API Key**
   - 在 `utils/routePlan.js` 中替换 `YOUR_TENCENT_MAP_KEY`

2. **配置域名白名单**（开发阶段可跳过）
   - 在微信公众平台配置 `apis.map.qq.com`

3. **测试功能**
   - 获取用户位置权限
   - 选择一个厕所
   - 点击"立即导航"按钮
   - 查看地图上的路线和文字指引

4. **验证功能**
   - ✅ 地图上显示红色路线
   - ✅ 显示用户位置和厕所位置 markers
   - ✅ 显示路线指引卡片
   - ✅ 显示总距离和预计时间
   - ✅ 显示详细路线步骤

## 常见问题

### Q: 路线规划失败？
**A:** 检查：
- API Key 是否正确配置
- 域名白名单是否已配置
- 网络连接是否正常
- 起点和终点坐标是否有效

### Q: 地图不显示路线？
**A:** 检查：
- `polyline` 数据是否正确
- 坐标点格式是否正确（`{latitude, longitude}`）
- 地图缩放级别是否合适
- `polyline` 数组格式是否正确

### Q: Markers 不显示？
**A:** 检查：
- `markers` 数组格式是否正确
- `id` 是否唯一
- `longitude` 和 `latitude` 是否有效
- `iconPath` 路径是否正确（如果使用自定义图标）

### Q: 开发阶段无法调用 API？
**A:** 在微信开发者工具中勾选"不校验合法域名"选项

## 后续优化方向

1. **实时导航**：定期更新用户位置，实现实时导航
2. **路线选择**：支持多条路线选择（最快、最短）
3. **语音提示**：集成语音合成，提供语音导航（可选）
4. **路线缓存**：缓存相同起终点的路线，减少 API 调用
5. **离线支持**：缓存路线数据，支持离线查看



