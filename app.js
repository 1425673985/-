// app.js
App({
  onLaunch() {
    // 小程序启动
    console.log('附近寻厕小程序启动')
  },
  globalData: {
    userLocation: null, // 用户位置
    toiletList: [], // 厕所列表
    currentToiletIndex: 0 // 当前厕所索引
  }
})
