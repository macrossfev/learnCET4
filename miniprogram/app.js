App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: 'cloud1-7g6c41u1faccceef',
      traceUser: true
    })

    this.globalData.settings = wx.getStorageSync('settings') || this.globalData.settings
  },

  globalData: {
    openid: null,
    settings: {
      dailyCount: 20,
      playMode: 'manual',   // manual | continuous
      playSpeed: 1.0
    }
  }
})
