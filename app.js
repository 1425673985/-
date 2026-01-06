App({
  onLaunch() {
    console.log('附近寻厕小程序启动')
  },
  globalData: {
    userLocation: null,
    toiletList: [],
    currentToiletIndex: 0,
    bestToilet: null
  }
})
