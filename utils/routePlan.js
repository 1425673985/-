/**
 * 路线规划工具
 * 使用腾讯地图 WebService API 获取步行路线
 * 
 * 注意：需要在 app.json 中配置 request 域名白名单
 * 开发时可在"详情-本地设置"中勾选"不校验合法域名"
 */

// 腾讯地图 WebService API Key（需要替换为你的实际 Key）
// 申请地址：https://lbs.qq.com/service/webService/webServiceGuide/webServiceOverview
const TENCENT_MAP_KEY = 'YOUR_TENCENT_MAP_KEY' // 请替换为你的 Key

/**
 * 获取步行路线规划
 * 使用腾讯地图 direction 接口（mode: walking）
 * @param {Object} from - 起点坐标 {latitude, longitude}
 * @param {Object} to - 终点坐标 {latitude, longitude}
 * @returns {Promise} 返回路线数据
 */
function getWalkingRoute(from, to) {
  return new Promise((resolve, reject) => {
    // 腾讯地图路线规划 API - direction 接口
    // 文档：https://lbs.qq.com/service/webService/webServiceGuide/webServiceRoute
    // API 地址：https://apis.map.qq.com/ws/direction/v1/walking/
    const url = `https://apis.map.qq.com/ws/direction/v1/walking/`
    
    wx.request({
      url: url,
      method: 'GET',
      data: {
        key: TENCENT_MAP_KEY,
        from: `${from.latitude},${from.longitude}`, // 格式：纬度,经度
        to: `${to.latitude},${to.longitude}`, // 格式：纬度,经度
        output: 'json' // 返回 JSON 格式
      },
      success: (res) => {
        console.log('路线规划 API 响应:', res.data)
        
        if (res.statusCode === 200 && res.data.status === 0) {
          const result = res.data.result
          const route = result.routes && result.routes[0]
          
          if (!route) {
            reject(new Error('未找到可用路线'))
            return
          }
          
          resolve({
            distance: route.distance || 0, // 总距离（米）
            duration: route.duration || 0, // 总时间（秒）
            steps: route.steps || [], // 路线步骤数组
            polyline: route.polyline || '' // 路线坐标点（压缩格式，需要解码）
          })
        } else {
          const errorMsg = res.data.message || `路线规划失败 (status: ${res.data.status})`
          console.error('路线规划失败:', errorMsg, res.data)
          reject(new Error(errorMsg))
        }
      },
      fail: (err) => {
        console.error('路线规划 API 请求失败:', err)
        reject(err)
      }
    })
  })
}

/**
 * 解析腾讯地图 polyline 格式
 * 腾讯地图返回的 polyline 是压缩格式，需要解码
 * @param {String} polyline - 压缩的坐标字符串
 * @returns {Array} 坐标点数组 [{latitude, longitude}, ...]
 */
function decodePolyline(polyline) {
  const points = []
  let index = 0
  let lat = 0
  let lng = 0
  
  while (index < polyline.length) {
    let b, shift = 0, result = 0
    do {
      b = polyline.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    
    const dlat = ((result & 1) !== 0) ? ~(result >> 1) : (result >> 1)
    lat += dlat
    
    shift = 0
    result = 0
    do {
      b = polyline.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    
    const dlng = ((result & 1) !== 0) ? ~(result >> 1) : (result >> 1)
    lng += dlng
    
    points.push({
      latitude: lat * 1e-5,
      longitude: lng * 1e-5
    })
  }
  
  return points
}

/**
 * 格式化路线步骤为文字指引
 * @param {Array} steps - 路线步骤数组
 * @returns {Array} 格式化后的指引数组
 */
function formatRouteSteps(steps) {
  if (!steps || steps.length === 0) return []
  
  return steps.map((step, index) => {
    const instruction = step.instruction || step.road || '继续前行'
    const distance = step.distance || 0
    const distanceText = distance < 1000 ? `${distance}米` : `${(distance / 1000).toFixed(1)}公里`
    
    return {
      index: index + 1,
      instruction: instruction.replace(/<[^>]+>/g, ''), // 移除 HTML 标签
      distance: distanceText,
      road: step.road || '',
      act_desc: step.act_desc || ''
    }
  })
}

module.exports = {
  getWalkingRoute,
  decodePolyline,
  formatRouteSteps
}

