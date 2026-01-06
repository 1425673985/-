# 小程序内导航功能配置说明

## 功能概述

已实现小程序内导航功能，不再跳转到腾讯地图小程序，避免系统确认弹窗。

## 技术方案

### 1. 路线规划 API
- **使用服务**：腾讯地图 WebService API
- **API 文档**：https://lbs.qq.com/service/webService/webServiceGuide/webServiceRoute
- **功能**：获取步行路线规划数据（距离、时间、路径坐标点、文字指引）

### 2. 地图显示
- **组件**：微信小程序 `<map />` 组件
- **功能**：
  - 显示用户当前位置（原生蓝色定位点）
  - 显示目标厕所位置（自定义 marker）
  - 使用 `polyline` 绘制步行路线（红色线条，带方向箭头）

### 3. 路径指引
- **显示方式**：信息卡片内的滚动列表
- **内容**：路线步骤、距离、文字指引

## 配置步骤

### 第一步：申请腾讯地图 API Key

1. 访问：https://lbs.qq.com/
2. 注册/登录账号
3. 创建应用，获取 **Key（密钥）**
4. 在 `utils/routePlan.js` 中替换 `YOUR_TENCENT_MAP_KEY`

```javascript
// utils/routePlan.js
const TENCENT_MAP_KEY = '你的腾讯地图 Key' // 替换这里
```

### 第二步：配置域名白名单

在微信公众平台配置：

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 **开发 > 开发管理 > 开发设置**
3. 在 **服务器域名** 中添加：
   - **request 合法域名**：`https://apis.map.qq.com`

**开发阶段**（本地调试）：
- 在微信开发者工具中：**详情 > 本地设置 > 不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书**
- 勾选此选项，可跳过域名校验

### 第三步：测试功能

1. 确保已获取用户位置权限
2. 选择一个厕所
3. 点击"立即导航"按钮
4. 查看地图上的路线和文字指引

## 核心代码说明

### 路线规划调用

```javascript
// pages/index/index.js
const routePlan = require('../../utils/routePlan.js')

// 调用路线规划
routePlan.getWalkingRoute(
  { latitude: userLat, longitude: userLng },
  { latitude: toiletLat, longitude: toiletLng }
).then((routeData) => {
  // routeData 包含：
  // - distance: 总距离（米）
  // - duration: 总时间（秒）
  // - steps: 路线步骤数组
  // - polyline: 压缩的坐标点字符串
})
```

### Polyline 数据格式

```javascript
polyline: [{
  points: [{latitude, longitude}, ...], // 坐标点数组
  color: '#FF6B6B', // 路线颜色
  width: 6, // 路线宽度
  arrowLine: true, // 显示方向箭头
  borderColor: '#FFFFFF', // 边框颜色
  borderWidth: 2 // 边框宽度
}]
```

## 微信小程序限制

### 1. 域名白名单
- 必须配置 `apis.map.qq.com` 为合法域名
- 开发阶段可勾选"不校验合法域名"进行调试

### 2. API 调用频率
- 腾讯地图 WebService API 有调用频率限制
- 建议：缓存路线数据，避免重复请求

### 3. Polyline 性能
- 路线点过多可能影响地图性能
- 建议：路线点超过 1000 个时进行抽稀处理

### 4. 地图组件限制
- `<map />` 组件不支持实时定位更新
- 如需实时导航，需要定期调用 `wx.getLocation()` 更新位置

## 功能特性

✅ **无跳转**：完全在小程序内完成导航  
✅ **无弹窗**：不会触发"即将打开小程序"确认  
✅ **路线显示**：地图上绘制红色路线，带方向箭头  
✅ **文字指引**：提供详细的路线步骤和距离  
✅ **自动适配**：地图自动调整视图，显示完整路线  

## 后续优化建议

1. **路线缓存**：相同起终点的路线可缓存，减少 API 调用
2. **实时定位**：定期更新用户位置，实现实时导航
3. **路线优化**：支持多条路线选择（最快、最短）
4. **语音提示**：集成语音合成，提供语音导航（可选）

## 常见问题

### Q: 路线规划失败？
A: 检查：
- API Key 是否正确配置
- 域名白名单是否已配置
- 网络连接是否正常

### Q: 地图不显示路线？
A: 检查：
- `polyline` 数据是否正确
- 坐标点格式是否正确（latitude, longitude）
- 地图缩放级别是否合适

### Q: 开发阶段无法调用 API？
A: 在微信开发者工具中勾选"不校验合法域名"选项



