// pages/index/index.js
const app = getApp()

// 确保 app 实例存在
if (!app) {
  console.error('App 实例未找到，请检查 app.js 是否正确初始化')
}

Page({
  data: {
    longitude: 116.397128,
    latitude: 39.916527,
    scale: 16,
    markers: [],
    showLocation: true, // 启用原生蓝色定位圆点（显示用户位置）
    showLocationButtons: false, // 是否显示地图左右两个定位按钮（默认隐藏，后续需要时再打开）
    currentToilet: null,
    toiletList: [],
    currentToiletIndex: 0,
    loading: false,
    searchRadius: 1000, // 当前搜索范围（米）
    userLocation: null, // 用户位置
    toastMessage: '', // 自定义提示消息
    showToast: false, // 是否显示自定义提示
    isUserLocating: false, // 是否正在定位用户位置
    cardAnimate: false, // 控制卡片动画
    statusBarHeight: 20, // 状态栏高度（px），默认值
    navBarHeight: 44, // 导航栏内容高度（px），默认值
    totalNavBarHeight: 128, // 总导航栏高度（rpx），默认值（约20+44=64px，转换为rpx约128）
    titleAnimate: false, // 控制标题动画
    searchStatus: 'locating' // 搜索状态：locating-定位中, found-已找到, noResult-无结果
  },

  onLoad() {
    // 获取系统信息，适配安全区域
    this.getSystemInfo()
    this.checkLocationPermission()
    // 初始化地图上下文
    this.mapContext = wx.createMapContext('map', this)
    // 初始化定时器变量
    this.focusTimer = null
    this.breathingTimer = null // 呼吸动画定时器
    this.breathingDirection = 1 // 呼吸动画方向：1-增大，-1-减小
    this.breathingAlpha = 1.0 // 当前透明度值
  },

  // 获取系统信息
  getSystemInfo() {
    const systemInfo = wx.getSystemInfoSync()
    const statusBarHeight = systemInfo.statusBarHeight || 0
    // 获取胶囊按钮信息（用于计算导航栏高度）
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    // 导航栏内容高度 = (胶囊按钮顶部距离 - 状态栏高度) * 2 + 胶囊按钮高度
    // 现在有两行内容（标题+状态），需要增加高度
    let navBarContentHeight = 60 // 默认60px（增加高度以容纳两行内容）
    if (menuButtonInfo) {
      // 基础高度 + 额外空间给状态文案
      navBarContentHeight = (menuButtonInfo.top - statusBarHeight) * 2 + menuButtonInfo.height + 16
    }
    
    // 计算总导航栏高度（状态栏 + 内容区域），转换为rpx
    const screenWidth = systemInfo.windowWidth || 375
    const rpxRatio = 750 / screenWidth
    const totalNavBarHeight = (statusBarHeight + navBarContentHeight) * rpxRatio
    
    this.setData({
      statusBarHeight: statusBarHeight,
      navBarHeight: navBarContentHeight,
      totalNavBarHeight: totalNavBarHeight
    })
  },

  onUnload() {
    // 页面卸载时清理定时器
    if (this.focusTimer) {
      clearTimeout(this.focusTimer)
      this.focusTimer = null
    }
    // 清理呼吸动画定时器
    if (this.breathingTimer) {
      clearInterval(this.breathingTimer)
      this.breathingTimer = null
    }
  },
  
  // 启动标记点呼吸动画效果（应急工具场景：轻微呼吸动画吸引注意）
  startMarkerBreathingAnimation() {
    // 清除之前的动画
    if (this.breathingTimer) {
      clearInterval(this.breathingTimer)
    }
    
    // 重置动画状态
    this.breathingAlpha = 1.0
    this.breathingDirection = -1
    
    // 每200ms更新一次透明度，实现呼吸效果
    this.breathingTimer = setInterval(() => {
      // 透明度范围：0.7 到 1.0，轻微呼吸效果（不抢焦点但足够吸引注意）
      const minAlpha = 0.7
      const maxAlpha = 1.0
      const step = 0.02
      
      if (this.breathingDirection === -1) {
        // 逐渐变淡
        this.breathingAlpha -= step
        if (this.breathingAlpha <= minAlpha) {
          this.breathingAlpha = minAlpha
          this.breathingDirection = 1
        }
      } else {
        // 逐渐变亮
        this.breathingAlpha += step
        if (this.breathingAlpha >= maxAlpha) {
          this.breathingAlpha = maxAlpha
          this.breathingDirection = -1
        }
      }
      
      // 更新当前标记的透明度
      const markers = this.data.markers
      if (markers && markers.length > 0) {
        const currentMarker = markers.find(m => m.id === 8888)
        if (currentMarker) {
          currentMarker.alpha = this.breathingAlpha
          this.setData({ markers: markers })
        }
      }
    }, 200)
  },

  // 检查定位权限
  checkLocationPermission() {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          // 已授权，获取位置
          this.getUserLocation()
        } else {
          // 未授权，请求授权
          this.requestLocationPermission()
        }
      },
      fail: () => {
        this.requestLocationPermission()
      }
    })
  },

  // 请求定位权限
  requestLocationPermission() {
    wx.authorize({
      scope: 'scope.userLocation',
      success: () => {
        this.getUserLocation()
      },
      fail: () => {
        wx.showModal({
          title: '定位权限',
          content: '需要获取您的位置信息才能查找附近厕所，请在设置中开启定位权限',
          showCancel: true,
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting()
            }
          }
        })
      }
    })
  },

  // 移动到用户位置（视觉聚焦）
  moveToLocation(longitude, latitude) {
    this.setData({
      longitude: longitude,
      latitude: latitude,
      scale: 16 // 合适的缩放级别
    })
  },

  // 获取用户位置
  getUserLocation() {
    this.setData({ 
      loading: true,
      searchStatus: 'locating' // 定位中
    })
    
    wx.getLocation({
      type: 'gcj02', // 返回可以用于腾讯地图的坐标类型
      success: (res) => {
        const { longitude, latitude } = res
        this.setData({
          longitude,
          latitude,
          userLocation: { longitude, latitude },
          searchRadius: 1000 // 搜索范围为1000m
        })
        
        // 保存到全局（确保 app 实例存在）
        if (app && app.globalData) {
          app.globalData.userLocation = { longitude, latitude }
        }
        
        // 移动到用户位置（视觉聚焦）
        this.moveToLocation(longitude, latitude)
        
        // 搜索附近厕所（统一使用1000m范围）
        this.searchNearbyToilets(longitude, latitude)
      },
      fail: (err) => {
        console.error('获取位置失败', err)
        this.setData({ 
          loading: false,
          searchStatus: 'noResult' // 定位失败，显示无结果
        })
        wx.showToast({
          title: '获取位置失败',
          icon: 'none'
        })
      }
    })
  },

  // 搜索附近厕所（统一使用1000m范围）
  searchNearbyToilets(longitude, latitude) {
    // 保存用户位置
    this.setData({ userLocation: { longitude, latitude } })
    
    // 使用腾讯地图API搜索附近厕所
    const key = 'M62BZ-XIQWA-Q2GKJ-C7MUC-LV5U5-QOFAT' // 腾讯地图API Key
    
    // 直接搜索1000m范围内的厕所
    this.searchWithRadius(longitude, latitude, 1000, key, (toilets) => {
      if (toilets.length > 0) {
        // 有厕所，使用这些厕所
        this.setData({ searchRadius: 1000 })
        this.processToiletList(toilets)
      } else {
        // 1000m内没有厕所，静默处理
        this.setData({ 
          searchRadius: 1000,
          loading: false,
          toiletList: [],
          currentToilet: null,
          searchStatus: 'noResult' // 无结果
        })
      }
    })
  },

  // 按指定范围搜索
  searchWithRadius(longitude, latitude, radius, key, callback) {
    // 搜索关键词：公共厕所、商场厕所、厕所等
    const keywords = ['公共厕所', '厕所', '卫生间', '洗手间']
    
    // 先搜索"公共厕所"
    this.searchWithKeyword(keywords[0], longitude, latitude, radius, key, (toilets) => {
      if (toilets.length > 0) {
        callback(toilets)
      } else {
        // 如果没找到，尝试其他关键词
        this.searchWithKeyword(keywords[1], longitude, latitude, radius, key, (toilets2) => {
          callback(toilets2)
        })
      }
    })
  },

  // 使用关键词搜索（支持指定范围）
  searchWithKeyword(keyword, longitude, latitude, radius, key, callback) {
    wx.request({
      url: 'https://apis.map.qq.com/ws/place/v1/search',
      method: 'GET',
      data: {
        keyword: keyword,
        boundary: `nearby(${latitude},${longitude},${radius})`, // 搜索指定范围内
        page_size: 20,
        orderby: '_distance', // 按距离排序
        key: key
      },
      success: (res) => {
        if (res.data.status === 0 && res.data.data) {
          const toilets = res.data.data.map(item => ({
            id: item.id,
            title: item.title,
            address: item.address, // 原始地址
            detailAddress: '', // 详细地址，稍后通过逆地址解析获取
            longitude: item.location.lng,
            latitude: item.location.lat,
            distance: Math.round(item._distance || 0),
            rating: item.rating || 0,
            comments: item.comments || []
          }))
          .filter(item => item.distance <= radius) // 过滤掉超出搜索范围的厕所
          
          // 按距离排序
          toilets.sort((a, b) => a.distance - b.distance)
          
          callback(toilets)
        } else {
          console.error('搜索失败', res.data)
          // 处理不同的错误状态码
          if (res.data.status === 311) {
            wx.showToast({
              title: 'Key格式错误，请检查配置',
              icon: 'none',
              duration: 3000
            })
            // Key错误时使用模拟数据，使用1000m范围
            this.useMockData(longitude, latitude, 1000)
          } else if (res.data.status === 310) {
            wx.showToast({
              title: 'Key错误或未授权',
              icon: 'none',
              duration: 3000
            })
            // Key错误时使用模拟数据，但需要传入搜索范围
            this.useMockData(longitude, latitude, radius)
          } else {
            wx.showToast({
              title: '搜索失败，使用模拟数据',
              icon: 'none',
              duration: 2000
            })
            this.useMockData(longitude, latitude, radius)
          }
          callback([])
        }
      },
      fail: (err) => {
        console.error('请求失败', err)
        // 如果API调用失败，使用模拟数据，使用1000m范围
        this.useMockData(longitude, latitude, 1000)
        callback([])
      }
    })
  },

  // 获取详细地址（通过逆地址解析）
  getDetailAddress(toilet, key) {
    return new Promise((resolve) => {
      wx.request({
        url: 'https://apis.map.qq.com/ws/geocoder/v1/',
        method: 'GET',
        data: {
          location: `${toilet.latitude},${toilet.longitude}`,
          key: key,
          get_poi: 1  // 获取POI信息，可能包含更详细的地址
        },
        success: (res) => {
          console.log('逆地址解析返回:', res.data)
          if (res.data.status === 0 && res.data.result) {
            const result = res.data.result
            let detailAddress = ''
            
            // 优先使用推荐地址（包含街道、路等详细信息）
            if (result.formatted_addresses && result.formatted_addresses.recommend) {
              detailAddress = result.formatted_addresses.recommend
            } else if (result.formatted_addresses && result.formatted_addresses.rough) {
              // 使用粗略地址
              detailAddress = result.formatted_addresses.rough
            } else if (result.address) {
              // 使用标准地址
              detailAddress = result.address
            } else if (result.address_component) {
              // 拼接地址组件：省+市+区+街道+路+门牌号
              const addr = result.address_component
              if (addr.province) detailAddress += addr.province
              if (addr.city && addr.city !== addr.province) detailAddress += addr.city
              if (addr.district) detailAddress += addr.district
              if (addr.street) detailAddress += addr.street
              if (addr.street_number) detailAddress += addr.street_number
            }
            
            // 验证获取到的地址是否比原始地址更详细
            // 如果获取到的地址包含"附近"且与原始地址相同或更短，说明获取失败
            if (detailAddress && detailAddress.trim() && 
                detailAddress.length > (toilet.address || '').length &&
                !detailAddress.includes('附近')) {
              console.log('获取到详细地址:', detailAddress)
              resolve(detailAddress)
            } else if (detailAddress && detailAddress.trim() && 
                       !detailAddress.includes('附近')) {
              // 即使长度不更长，只要不包含"附近"，也使用
              console.log('获取到地址（不含附近）:', detailAddress)
              resolve(detailAddress)
            } else {
              // 获取到的地址不详细，尝试使用原始地址
              console.log('获取到的地址不详细，使用原始地址:', toilet.address)
              resolve(toilet.address)
            }
          } else {
            console.log('逆地址解析失败，使用原始地址:', toilet.address)
            resolve(toilet.address)
          }
        },
        fail: (err) => {
          console.error('逆地址解析请求失败:', err)
          resolve(toilet.address)
        }
      })
    })
  },

  // 批量获取详细地址（异步）
  async enrichToiletsWithDetailAddress(toilets, key) {
    // 获取所有厕所的详细地址（不限制数量，确保都能获取到）
    for (let i = 0; i < toilets.length; i++) {
      const toilet = toilets[i]
      // 如果原始地址已经包含详细地址信息（不包含"附近"），可以跳过
      if (toilet.address && !toilet.address.includes('附近') && toilet.address.trim().length > 5) {
        toilet.detailAddress = toilet.address
        console.log(`厕所${i+1}使用原始地址（已详细）:`, toilet.detailAddress)
      } else {
        // 需要获取详细地址
        const detailAddress = await this.getDetailAddress(toilet, key)
        // 如果获取到的详细地址比原始地址更详细，使用详细地址；否则使用原始地址
        if (detailAddress && detailAddress.trim() && 
            detailAddress.length > toilet.address.length && 
            !detailAddress.includes('附近')) {
          toilet.detailAddress = detailAddress
        } else if (detailAddress && detailAddress.trim()) {
          toilet.detailAddress = detailAddress
        } else {
          toilet.detailAddress = toilet.address
        }
        console.log(`厕所${i+1}详细地址:`, toilet.detailAddress)
      }
    }
    
    return toilets
  },
  
  // 刷新单个厕所的详细地址
  async refreshDetailAddress(toilet) {
    if (toilet.isGettingDetailAddress) return
    
    toilet.isGettingDetailAddress = true
    const key = 'M62BZ-XIQWA-Q2GKJ-C7MUC-LV5U5-QOFAT'
    const detailAddress = await this.getDetailAddress(toilet, key)
    
    if (detailAddress && detailAddress.trim() && 
        detailAddress.length > (toilet.address || '').length && 
        !detailAddress.includes('附近')) {
      toilet.detailAddress = detailAddress
      
      // 更新当前显示的厕所信息
      if (this.data.currentToilet && this.data.currentToilet.id === toilet.id) {
        const displayAddress = detailAddress
        const currentToiletData = Object.assign({}, this.data.currentToilet, {
          detailAddress: detailAddress,
          displayAddress: displayAddress
        })
        this.setData({ currentToilet: currentToiletData })
      }
      
      // 更新列表中的厕所信息
      const index = this.data.toiletList.findIndex(t => t.id === toilet.id)
      if (index >= 0) {
        this.data.toiletList[index].detailAddress = detailAddress
        this.setData({ toiletList: this.data.toiletList })
        if (app && app.globalData) {
          app.globalData.toiletList = this.data.toiletList
        }
      }
    }
    
    toilet.isGettingDetailAddress = false
  },

  // 处理厕所列表
  async processToiletList(toilets) {
    if (toilets.length === 0) {
      this.setData({ 
        loading: false,
        searchStatus: 'noResult' // 无结果
      })
      wx.showToast({
        title: '附近没有找到厕所',
        icon: 'none'
      })
      return
    }

    // 标记距离最近的厕所（第一个就是最近的，因为已经按距离排序）
    if (toilets.length > 0) {
      toilets[0].isNearest = true
      // 其他厕所标记为false
      for (let i = 1; i < toilets.length; i++) {
        toilets[i].isNearest = false
      }
    }

    // 获取详细地址
    const key = 'M62BZ-XIQWA-Q2GKJ-C7MUC-LV5U5-QOFAT'
    console.log('开始获取详细地址，厕所数量:', toilets.length)
    await this.enrichToiletsWithDetailAddress(toilets, key)
    console.log('详细地址获取完成')

    // 保存到全局和本地
    if (app && app.globalData) {
      app.globalData.toiletList = toilets
      app.globalData.currentToiletIndex = 0
    }

    this.setData({
      toiletList: toilets,
      currentToiletIndex: 0,
      loading: false,
      searchStatus: 'found' // 已找到
    })

    // 显示第一个厕所（最近距离的）
    this.showToilet(0)
    
    // 触发标题淡入动画
    this.setData({ titleAnimate: true })
    
    // 首次进入时，调整地图视图同时显示用户位置和厕所位置
    // 延迟一下确保用户位置已经获取
    setTimeout(() => {
      this.adjustMapToShowBothLocations()
    }, 500)
  },

  // 显示指定索引的厕所
  showToilet(index, shouldAnimate = false) {
    if (index < 0 || index >= this.data.toiletList.length) {
      return
    }

    const toilet = this.data.toiletList[index]
    
    // 如果需要动画，先重置动画状态
    if (shouldAnimate) {
      this.setData({ cardAnimate: false })
      // 短暂延迟后触发动画
      setTimeout(() => {
        this.setData({ cardAnimate: true })
      }, 10)
    }
    
    // 更新地图标记：只显示当前厕所位置（用户位置使用原生蓝色定位圆点）
    const markers = []
    
    // 添加当前厕所标记 - 应急工具场景：放大并高亮
    // 使用自定义图标，强调"这是厕所"，与默认POI区分
    markers.push({
      id: 8888, // 当前厕所使用数字ID 8888
      longitude: toilet.longitude,
      latitude: toilet.latitude,
      // 放大图标：80x80px（2倍图，实际显示40x40px），更醒目
      width: 80,
      height: 80,
      // 使用自定义图标路径（如果存在），否则使用默认样式
      // 图标设计：圆形背景 + 厕所图标，红色系，与默认POI区分
      // iconPath: '/images/toilet-marker.png', // 自定义厕所图标（文件不存在时注释掉，使用默认样式）
      // 高亮样式：使用醒目的颜色和样式
      callout: {
        content: toilet.title,
        color: '#1A1A1A',
        fontSize: 16,
        borderRadius: 12,
        bgColor: '#FFFFFF',
        padding: 12,
        display: 'ALWAYS' // 始终显示，确保用户能快速找到
      },
      // 标记点透明度：1.0 表示完全不透明，确保清晰可见
      alpha: 1.0,
      // 锚点设置：确保图标中心对准位置
      anchor: {
        x: 0.5,
        y: 0.5
      }
    })
    
    // 启动呼吸动画效果（通过定期更新 alpha 值模拟）
    this.startMarkerBreathingAnimation()

    // 确保使用详细地址
    // 优先使用detailAddress，如果detailAddress不详细或与address相同，则尝试使用address
    let displayAddress = ''
    
    // 判断地址是否详细（不包含"附近"等模糊描述，且长度足够）
    const isDetailAddressValid = (addr) => {
      if (!addr || !addr.trim()) return false
      // 如果地址太短（少于5个字符），认为不详细
      if (addr.trim().length < 5) return false
      // 如果包含"附近"等模糊描述，认为不详细
      if (addr.includes('附近') || addr.includes('附近街道') || addr.includes('附近商场')) {
        return false
      }
      return true
    }
    
    // 优先使用detailAddress（如果它比address更详细）
    if (toilet.detailAddress && isDetailAddressValid(toilet.detailAddress)) {
      displayAddress = toilet.detailAddress
    } else if (toilet.address && isDetailAddressValid(toilet.address)) {
      displayAddress = toilet.address
    } else {
      // 如果都不详细，选择更长的那个，或者优先使用detailAddress
      const detailAddr = toilet.detailAddress || ''
      const addr = toilet.address || ''
      
      // 如果detailAddress比address更详细（更长或包含更多信息），使用detailAddress
      if (detailAddr.length > addr.length && detailAddr.trim().length > 0) {
        displayAddress = detailAddr
      } else if (addr.trim().length > 0) {
        displayAddress = addr
      } else if (detailAddr.trim().length > 0) {
        displayAddress = detailAddr
      } else {
        displayAddress = '地址信息获取中...'
      }
    }
    
    // 如果最终地址仍然包含"附近"，且detailAddress与address相同或未设置，尝试重新获取详细地址
    if (displayAddress.includes('附近') && 
        !toilet.isGettingDetailAddress &&
        (!toilet.detailAddress || toilet.detailAddress === toilet.address || toilet.detailAddress.includes('附近'))) {
      // 延迟获取，避免阻塞显示
      setTimeout(() => {
        this.refreshDetailAddress(toilet)
      }, 500)
    }
    
    console.log('显示地址 - detailAddress:', toilet.detailAddress, 'address:', toilet.address, '最终:', displayAddress)

    // 计算步行时间（决策优先级第一）
    const walkingTime = this.calculateWalkingTime(toilet.distance)
    const walkingTimeText = this.formatWalkingTime(walkingTime)
    
    // 使用 Object.assign 替代扩展运算符，避免 Babel 依赖问题
    // 构建可扩展的数据结构，方便后续添加评分、类型等信息
    const currentToiletData = Object.assign({}, toilet, {
      displayAddress: displayAddress, // 添加显示用的地址字段
      walkingTime: walkingTime, // 步行时间（分钟）
      walkingTimeText: walkingTimeText, // 格式化的步行时间文本
      // 可扩展字段预留：
      // rating: toilet.rating || null, // 评分（0-5）
      // type: toilet.type || 'public', // 类型：public-公共, mall-商场, subway-地铁等
      // facilities: toilet.facilities || [], // 设施：['accessible', 'baby', 'clean']等
      // openingHours: toilet.openingHours || null, // 营业时间
      // isFree: toilet.isFree !== undefined ? toilet.isFree : true // 是否免费
    })
    
    // 更新当前厕所信息
    this.setData({
      currentToilet: currentToiletData,
      currentToiletIndex: index,
      markers: markers
    })
    
    // 调整地图视图，同时显示用户位置和厕所位置（整体居中）
    // 延迟一下确保数据已更新
    setTimeout(() => {
      this.adjustMapToShowBothLocations()
    }, 100)

    // 更新全局索引
    if (app && app.globalData) {
      app.globalData.currentToiletIndex = index
    }
  },

  // 切换到下一个厕所（在当前搜索范围内循环）
  switchToNextToilet() {
    if (this.data.toiletList.length <= 1) {
      wx.showToast({
        title: '当前范围内只有这一个厕所',
        icon: 'none',
        duration: 1500
      })
      return
    }

    const nextIndex = (this.data.currentToiletIndex + 1) % this.data.toiletList.length
    
    // 刷新用户位置：重新获取用户当前位置
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const { longitude, latitude } = res
        const userLocation = { longitude, latitude }
        
        // 更新用户位置
        this.setData({ userLocation })
        if (app && app.globalData) {
          app.globalData.userLocation = userLocation
        }
        
        // 重新计算所有厕所的距离（基于当前用户位置）
        this.data.toiletList.forEach(toilet => {
          const distance = this.calculateDistance(
            latitude,
            longitude,
            toilet.latitude,
            toilet.longitude
          )
          toilet.distance = Math.round(distance)
        })
        
        // 按距离重新排序
        this.data.toiletList.sort((a, b) => a.distance - b.distance)
        
        // 找到下一个厕所的新索引（因为排序后索引可能变化）
        const nextToilet = this.data.toiletList[nextIndex]
        const newIndex = this.data.toiletList.findIndex(t => t.id === nextToilet.id)
        const finalIndex = newIndex >= 0 ? newIndex : nextIndex
        
        // 更新列表数据
        this.setData({ toiletList: this.data.toiletList })
        if (app && app.globalData) {
          app.globalData.toiletList = this.data.toiletList
        }
        
        // 显示下一个厕所，地图中心定位到厕所位置（触发动画）
        this.showToilet(finalIndex, true)
        
        // 如果当前厕所的详细地址不完整（包含"附近"），重新获取
        const currentToilet = this.data.toiletList[finalIndex]
        if (currentToilet && 
            (!currentToilet.detailAddress || 
             currentToilet.detailAddress.includes('附近') ||
             currentToilet.detailAddress === currentToilet.address)) {
          this.refreshDetailAddress(currentToilet)
        }
      },
      fail: (err) => {
        console.error('获取位置失败', err)
        // 如果获取位置失败，仍然切换厕所，但使用之前的位置计算距离
        const userLocation = this.data.userLocation || app.globalData.userLocation
        if (userLocation) {
          const toilet = this.data.toiletList[nextIndex]
          const distance = this.calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            toilet.latitude,
            toilet.longitude
          )
          toilet.distance = Math.round(distance)
        }
        this.showToilet(nextIndex, true)
      }
    })
  },

  // 导航到厕所
  navigateToToilet() {
    const toilet = this.data.currentToilet
    if (!toilet) {
      wx.showToast({
        title: '请先选择厕所',
        icon: 'none'
      })
      return
    }

    // 跳转到腾讯地图导航
    const destination = `${toilet.latitude},${toilet.longitude}`
    const destinationName = encodeURIComponent(toilet.title)
    
    // 优先使用腾讯地图小程序跳转
    wx.navigateToMiniProgram({
      appId: 'wx5bc2ac602a747594', // 腾讯地图小程序appid
      path: `pages/route/route?type=drive&to=${destination}&toname=${destinationName}`,
      success: () => {
        console.log('跳转到腾讯地图成功')
      },
      fail: (err) => {
        console.error('跳转失败', err)
        // 如果跳转失败，使用微信内置打开地图功能
        wx.openLocation({
          latitude: toilet.latitude,
          longitude: toilet.longitude,
          name: toilet.title,
          address: toilet.address,
          scale: 18,
          success: () => {
            console.log('打开地图成功')
          },
          fail: (openErr) => {
            console.error('打开地图失败', openErr)
            // 最后提示用户手动导航
            wx.showModal({
              title: '导航',
              content: `目的地：${toilet.title}\n地址：${toilet.address}\n\n请使用地图应用导航`,
              showCancel: false
            })
          }
        })
      }
    })
  },

  // 地图点击事件
  onMapTap(e) {
    console.log('地图被点击', e)
  },

  // 平滑地图聚焦函数（通用缩放函数）
  smoothMapFocus(targetLatitude, targetLongitude) {
    // 清除之前的定时器（如果存在）
    if (this.focusTimer) {
      clearTimeout(this.focusTimer)
      this.focusTimer = null
    }

    // 确保地图上下文已初始化
    if (!this.mapContext) {
      this.mapContext = wx.createMapContext('map', this)
    }

    // 检测运行环境
    const systemInfo = wx.getSystemInfoSync()
    const isDevTools = systemInfo.platform === 'devtools'

    // 第一阶段：局部放大聚焦
    // 先设置地图中心和缩放级别（确保地图状态正确）
    this.setData({
      longitude: targetLongitude,
      latitude: targetLatitude,
      scale: 18
    })

    // 在真机环境下，尝试使用 moveToLocation 增强动画效果
    if (!isDevTools) {
      // 延迟一下，确保 setData 生效后再调用 API
      setTimeout(() => {
        if (this.mapContext) {
          this.mapContext.moveToLocation({
            latitude: targetLatitude,
            longitude: targetLongitude,
            success: () => {
              console.log('地图移动到目标位置成功')
            },
            fail: (err) => {
              console.warn('地图移动API调用失败，已使用setData方式', err)
              // API失败不影响功能，因为已经用setData设置了
            }
          })
        }
      }, 100)
    }

    // 第二阶段：自动恢复全景
    // 设置 1.5-2秒的定时器
    const delay = 1750 // 1.75秒，介于1.5秒和2秒之间
    this.focusTimer = setTimeout(() => {
      const userLocation = this.data.userLocation || app.globalData.userLocation
      const currentToilet = this.data.currentToilet

      // 检测运行环境
      const systemInfo = wx.getSystemInfoSync()
      const isDevTools = systemInfo.platform === 'devtools'

      // 如果用户位置和厕所位置都存在，使用 includePoints 同时显示两个点
      if (userLocation && currentToilet) {
        // 先使用 adjustMapToShowBothLocations 确保基础功能正常（兼容所有环境）
        this.adjustMapToShowBothLocations()
        
        // 在真机环境下，尝试使用 includePoints 增强效果
        if (!isDevTools && this.mapContext) {
          setTimeout(() => {
            const points = [
              {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude
              },
              {
                latitude: currentToilet.latitude,
                longitude: currentToilet.longitude
              }
            ]

            // 调用 includePoints 方法，设置合适的 padding
            this.mapContext.includePoints({
              points: points,
              padding: [80, 80, 80, 80], // 上、右、下、左的内边距
              success: () => {
                console.log('地图自动恢复全景成功')
              },
              fail: (err) => {
                console.warn('地图自动恢复全景API调用失败，已使用备选方案', err)
                // API失败不影响功能，因为已经用adjustMapToShowBothLocations设置了
              }
            })
          }, 100)
        }
      } else if (userLocation) {
        // 如果只有用户位置，只聚焦到用户位置
        // 先使用 setData 确保基础功能正常
        this.setData({
          longitude: userLocation.longitude,
          latitude: userLocation.latitude,
          scale: 16
        })
        
        // 在真机环境下，尝试使用 moveToLocation 增强效果
        if (!isDevTools && this.mapContext) {
          setTimeout(() => {
            this.mapContext.moveToLocation({
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              success: () => {
                console.log('地图移动到用户位置成功')
              },
              fail: (err) => {
                console.warn('地图移动API调用失败，已使用setData方式', err)
                // API失败不影响功能，因为已经用setData设置了
              }
            })
          }, 100)
        }
      }

      // 清除定时器引用
      this.focusTimer = null
    }, delay)
  },

  // 定位到用户当前位置
  locateUser() {
    // 检查定位权限
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          // 已授权，获取位置后调用聚焦函数
          wx.getLocation({
            type: 'gcj02',
            success: (locationRes) => {
              const { longitude, latitude } = locationRes
              
              // 更新用户位置
              this.setData({
                userLocation: { longitude, latitude }
              })
              if (app && app.globalData) {
                app.globalData.userLocation = { longitude, latitude }
              }
              
              // 调用平滑聚焦函数，传入用户坐标
              this.smoothMapFocus(latitude, longitude)
            },
            fail: (err) => {
              console.error('获取位置失败', err)
              wx.showToast({
                title: '获取位置失败',
                icon: 'none'
              })
            }
          })
        } else {
          // 未授权，请求授权
          this.requestLocationPermission()
        }
      },
      fail: () => {
        this.requestLocationPermission()
      }
    })
  },

  // 获取用户位置并重新定位（带放大特效，不刷新厕所，同时显示所有厕所和用户位置）
  getUserLocationAndRelocate() {
    wx.showLoading({
      title: '定位中...',
      mask: true
    })

    // 设置正在定位用户位置的标志
    this.setData({
      isUserLocating: true
    })

    wx.getLocation({
      type: 'gcj02', // 返回可以用于腾讯地图的坐标类型
      success: (res) => {
        const { longitude, latitude } = res
        
        // 保存到全局（确保 app 实例存在）
        if (app && app.globalData) {
          app.globalData.userLocation = { longitude, latitude }
        }
        
        // 更新用户位置
        this.setData({
          userLocation: { longitude, latitude }
        })
        
        // 计算合适的缩放级别和中心点，使用户位置和当前厕所位置都能显示
        const currentToilet = this.data.currentToilet
        if (currentToilet) {
          // 有当前厕所，计算两点边界
          const bounds = this.calculateBoundsForTwoPoints(longitude, latitude, currentToilet.longitude, currentToilet.latitude)
          
          // 第一步：先放大并移动到计算的中心位置（放大特效）
          this.setData({
            longitude: bounds.centerLng,
            latitude: bounds.centerLat,
            scale: 18, // 放大到18级，实现放大特效
          })
          
          // 第二步：延迟后调整到合适的缩放级别，让两个点都能显示
          setTimeout(() => {
            this.setData({
              scale: bounds.scale // 使用计算出的合适缩放级别
            })
          }, 500)
        } else {
          // 没有当前厕所，只定位到用户位置
          this.setData({
            longitude,
            latitude,
            scale: 18, // 放大到18级，实现放大特效
          })
          
          // 延迟后稍微缩小
          setTimeout(() => {
            this.setData({
              scale: 16 // 缩小到16级，视野更合适
            })
          }, 500)
        }
        
        // 更新地图标记，只显示用户位置和当前厕所位置
        this.updateMapMarkersForUserLocation(longitude, latitude)
        
        // 调整地图视图，确保用户位置和厕所位置都在画面中
        setTimeout(() => {
          this.adjustMapToShowBothLocations()
        }, 600) // 延迟到缩放动画完成后
        
        // 延迟清除定位标志
        setTimeout(() => {
          this.setData({
            isUserLocating: false
          })
        }, 2000) // 2秒后清除标志，确保动画完成
        
        wx.hideLoading()
        wx.showToast({
          title: '定位成功',
          icon: 'success',
          duration: 1500
        })
      },
      fail: (err) => {
        console.error('获取位置失败', err)
        this.setData({
          isUserLocating: false
        })
        wx.hideLoading()
        wx.showToast({
          title: '定位失败，请检查定位权限',
          icon: 'none',
          duration: 2000
        })
      }
    })
  },

  // 计算边界框，确定合适的中心点和缩放级别
  calculateBounds(userLng, userLat) {
    const toilets = this.data.toiletList
    let minLng = userLng
    let maxLng = userLng
    let minLat = userLat
    let maxLat = userLat

    // 如果有厕所，计算所有点的边界
    if (toilets && toilets.length > 0) {
      toilets.forEach(toilet => {
        minLng = Math.min(minLng, toilet.longitude)
        maxLng = Math.max(maxLng, toilet.longitude)
        minLat = Math.min(minLat, toilet.latitude)
        maxLat = Math.max(maxLat, toilet.latitude)
      })
    }

    // 计算中心点
    const centerLng = (minLng + maxLng) / 2
    const centerLat = (minLat + maxLat) / 2

    // 计算距离范围（米）
    const lngRange = this.calculateDistance(centerLat, minLng, centerLat, maxLng)
    const latRange = this.calculateDistance(minLat, centerLng, maxLat, centerLng)
    const maxRange = Math.max(lngRange, latRange)

    // 根据距离范围计算合适的缩放级别
    // 缩放级别参考：1级=世界，18级=街道
    let scale = 16
    if (maxRange > 5000) {
      scale = 12 // 5公里以上
    } else if (maxRange > 2000) {
      scale = 13 // 2-5公里
    } else if (maxRange > 1000) {
      scale = 14 // 1-2公里
    } else if (maxRange > 500) {
      scale = 15 // 500米-1公里
    } else if (maxRange > 200) {
      scale = 16 // 200-500米
    } else {
      scale = 17 // 200米以内
    }

    // 添加一些边距，确保所有点都能显示
    const padding = maxRange * 0.2 // 20%的边距
    const adjustedRange = maxRange + padding

    // 根据调整后的范围重新计算缩放级别
    if (adjustedRange > 5000) {
      scale = 12
    } else if (adjustedRange > 2000) {
      scale = 13
    } else if (adjustedRange > 1000) {
      scale = 14
    } else if (adjustedRange > 500) {
      scale = 15
    } else if (adjustedRange > 200) {
      scale = 16
    } else {
      scale = 17
    }

    return {
      centerLng,
      centerLat,
      scale,
      minLng,
      maxLng,
      minLat,
      maxLat
    }
  },

  // 计算两个点的边界框，确定合适的中心点和缩放级别
  calculateBoundsForTwoPoints(lng1, lat1, lng2, lat2) {
    const minLng = Math.min(lng1, lng2)
    const maxLng = Math.max(lng1, lng2)
    const minLat = Math.min(lat1, lat2)
    const maxLat = Math.max(lat1, lat2)

    // 计算中心点
    const centerLng = (minLng + maxLng) / 2
    const centerLat = (minLat + maxLat) / 2

    // 计算距离范围（米）
    const lngRange = this.calculateDistance(centerLat, minLng, centerLat, maxLng)
    const latRange = this.calculateDistance(minLat, centerLng, maxLat, centerLng)
    const maxRange = Math.max(lngRange, latRange)

    // 根据距离范围计算合适的缩放级别
    let scale = 16
    if (maxRange > 5000) {
      scale = 12
    } else if (maxRange > 2000) {
      scale = 13
    } else if (maxRange > 1000) {
      scale = 14
    } else if (maxRange > 500) {
      scale = 15
    } else if (maxRange > 200) {
      scale = 16
    } else {
      scale = 17
    }

    // 添加边距，确保两个点都能显示
    const padding = maxRange * 0.3 // 30%的边距
    const adjustedRange = maxRange + padding

    // 根据调整后的范围重新计算缩放级别
    if (adjustedRange > 5000) {
      scale = 12
    } else if (adjustedRange > 2000) {
      scale = 13
    } else if (adjustedRange > 1000) {
      scale = 14
    } else if (adjustedRange > 500) {
      scale = 15
    } else if (adjustedRange > 200) {
      scale = 16
    } else {
      scale = 17
    }

    return {
      centerLng,
      centerLat,
      scale
    }
  },

  // 更新地图标记，只显示所有厕所（用户位置使用原生蓝色定位圆点）
  updateMapMarkersWithUserLocation(userLng, userLat) {
    const markers = []
    const toilets = this.data.toiletList

    // 只添加所有厕所标记（用户位置使用原生蓝色定位圆点，不需要添加到markers）
    if (toilets && toilets.length > 0) {
      toilets.forEach((toilet, index) => {
        markers.push({
          id: index,
          longitude: toilet.longitude,
          latitude: toilet.latitude,
          width: 40,
          height: 40,
          callout: {
            content: toilet.title,
            color: '#333',
            fontSize: 14,
            borderRadius: 5,
            bgColor: '#fff',
            padding: 10,
            display: 'BYCLICK'
          }
        })
      })
    }

    this.setData({ markers })
  },

  // 更新地图标记，只显示当前厕所位置（用户位置使用原生蓝色定位圆点）
  updateMapMarkersForUserLocation(userLng, userLat) {
    const markers = []
    const currentToilet = this.data.currentToilet

    // 只添加当前厕所标记（用户位置使用原生蓝色定位圆点，不需要添加到markers）
    if (currentToilet) {
      markers.push({
        id: 8888, // 当前厕所使用数字ID 8888
        longitude: currentToilet.longitude,
        latitude: currentToilet.latitude,
        width: 40,
        height: 40,
        callout: {
          content: currentToilet.title,
          color: '#333',
          fontSize: 14,
          borderRadius: 5,
          bgColor: '#fff',
          padding: 10,
          display: 'ALWAYS' // 始终显示
        }
      })
    }

    this.setData({ markers })
  },

  // 调整地图视图，同时显示用户位置和当前厕所位置
  adjustMapToShowBothLocations() {
    const userLocation = this.data.userLocation || app.globalData.userLocation
    const currentToilet = this.data.currentToilet

    // 如果没有用户位置或当前厕所，不调整
    if (!userLocation || !currentToilet) {
      return
    }

    // 计算用户位置和当前厕所位置的边界
    const minLng = Math.min(userLocation.longitude, currentToilet.longitude)
    const maxLng = Math.max(userLocation.longitude, currentToilet.longitude)
    const minLat = Math.min(userLocation.latitude, currentToilet.latitude)
    const maxLat = Math.max(userLocation.latitude, currentToilet.latitude)

    // 计算中心点
    const centerLng = (minLng + maxLng) / 2
    const centerLat = (minLat + maxLat) / 2

    // 计算距离范围（米）
    const lngRange = this.calculateDistance(centerLat, minLng, centerLat, maxLng)
    const latRange = this.calculateDistance(minLat, centerLng, maxLat, centerLng)
    const maxRange = Math.max(lngRange, latRange)

    // 添加边距，确保两个点都能完整显示（40%的边距，确保不会太紧）
    const padding = maxRange * 0.4
    const adjustedRange = maxRange + padding

    // 根据调整后的范围计算合适的缩放级别（距离较远时适当缩小比例）
    let scale = 16
    if (adjustedRange > 10000) {
      scale = 11 // 10公里以上
    } else if (adjustedRange > 5000) {
      scale = 12 // 5-10公里
    } else if (adjustedRange > 2000) {
      scale = 13 // 2-5公里
    } else if (adjustedRange > 1000) {
      scale = 14 // 1-2公里
    } else if (adjustedRange > 500) {
      scale = 15 // 500米-1公里
    } else if (adjustedRange > 200) {
      scale = 16 // 200-500米
    } else {
      scale = 17 // 200米以内
    }

    // 更新地图中心点和缩放级别（整体居中显示）
    this.setData({
      longitude: centerLng,
      latitude: centerLat,
      scale: scale
    })
    
    // 确保厕所标记显示（用户位置使用原生蓝色定位圆点，不需要添加到markers）
    const currentToiletData = this.data.currentToilet
    if (currentToiletData) {
      const currentMarkers = this.data.markers || []
      const hasToiletMarker = currentMarkers.some(m => m.id === 8888)
      
      if (!hasToiletMarker) {
        const markers = []
        // 只添加当前厕所标记
        markers.push({
          id: 8888,
          longitude: currentToiletData.longitude,
          latitude: currentToiletData.latitude,
          width: 40,
          height: 40,
          callout: {
            content: currentToiletData.title,
            color: '#333',
            fontSize: 14,
            borderRadius: 5,
            bgColor: '#fff',
            padding: 10,
            display: 'ALWAYS'
          }
        })
        this.setData({ markers })
      }
    }
  },

  // 定位到当前显示的厕所位置（同时显示用户位置和厕所位置）
  locateToToilet() {
    const toilet = this.data.currentToilet
    if (!toilet) {
      wx.showToast({
        title: '没有可定位的厕所',
        icon: 'none'
      })
      return
    }

    const userLocation = this.data.userLocation || app.globalData.userLocation
    if (!userLocation) {
      wx.showToast({
        title: '请先获取用户位置',
        icon: 'none'
      })
      return
    }

    // 更新地图标记：只显示厕所位置（用户位置使用原生蓝色定位圆点）
    const markers = []
    
    // 只添加当前厕所标记
    markers.push({
      id: 8888,
      longitude: toilet.longitude,
      latitude: toilet.latitude,
      width: 40,
      height: 40,
      callout: {
        content: toilet.title,
        color: '#333',
        fontSize: 14,
        borderRadius: 5,
        bgColor: '#fff',
        padding: 10,
        display: 'ALWAYS' // 始终显示
      }
    })

    this.setData({ markers })

    // 调用平滑聚焦函数，传入厕所坐标
    this.smoothMapFocus(toilet.latitude, toilet.longitude)

    wx.showToast({
      title: '已定位到该厕所',
      icon: 'success',
      duration: 1500
    })
  },

  // 使用模拟数据（当API不可用时，统一使用1000m范围）
  useMockData(longitude, latitude, radius = 1000) {
    // 生成模拟数据，根据搜索范围过滤
    const allMockToilets = [
      {
        id: '1',
        title: '公共厕所',
        address: '附近街道',
        detailAddress: '北京市朝阳区建国路88号',
        longitude: longitude + 0.001,
        latitude: latitude + 0.001,
        distance: 150,
        rating: 4.5,
        comments: ['环境干净', '设施齐全']
      },
      {
        id: '2',
        title: '商场卫生间',
        address: '附近商场',
        detailAddress: '北京市朝阳区三里屯街道工体北路8号',
        longitude: longitude + 0.002,
        latitude: latitude + 0.001,
        distance: 300,
        rating: 4.8,
        comments: ['非常干净', '有母婴室']
      },
      {
        id: '3',
        title: '公共卫生间',
        address: '附近公园',
        detailAddress: '北京市朝阳区朝阳公园南路1号',
        longitude: longitude - 0.001,
        latitude: latitude + 0.002,
        distance: 450,
        rating: 4.0,
        comments: ['位置方便']
      },
      {
        id: '4',
        title: '地铁站卫生间',
        address: '地铁站内',
        detailAddress: '北京市朝阳区建国门外大街1号',
        longitude: longitude + 0.003,
        latitude: latitude + 0.002,
        distance: 700,
        rating: 4.2,
        comments: ['方便快捷']
      }
    ]

    // 计算实际距离并过滤在搜索范围内的厕所
    const mockToilets = allMockToilets.map(toilet => {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        toilet.latitude,
        toilet.longitude
      )
      toilet.distance = Math.round(distance)
      return toilet
    }).filter(toilet => toilet.distance <= radius) // 只保留在搜索范围内的

    // 按距离排序
    mockToilets.sort((a, b) => a.distance - b.distance)

    if (mockToilets.length === 0) {
      // 模拟数据中没有符合范围的，静默处理
      this.setData({ 
        searchRadius: 1000,
        loading: false,
        toiletList: [],
        currentToilet: null
      })
    } else {
      // 设置搜索范围
      this.setData({ searchRadius: radius })
      this.processToiletList(mockToilets)
    }
  },

  // 显示自定义底部提示
  showCustomToast(message, duration = 1500) {
    this.setData({
      toastMessage: message,
      showToast: true
    })
    
    setTimeout(() => {
      this.setData({
        showToast: false,
        toastMessage: ''
      })
    }, duration)
  },

  // 计算两点间距离（米）
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000 // 地球半径（米）
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  },

  // 计算步行时间（分钟）
  // 假设平均步行速度：1.2m/s（约4.3km/h），适合应急场景
  calculateWalkingTime(distanceInMeters) {
    const walkingSpeed = 1.2 // 米/秒
    const timeInSeconds = distanceInMeters / walkingSpeed
    const timeInMinutes = Math.ceil(timeInSeconds / 60) // 向上取整，更符合用户预期
    return timeInMinutes
  },

  // 格式化步行时间显示
  formatWalkingTime(minutes) {
    if (minutes < 1) {
      return '不到1分钟'
    } else if (minutes === 1) {
      return '约1分钟'
    } else {
      return `约${minutes}分钟`
    }
  }
})

