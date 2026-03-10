/**
 * 应用入口
 */
const config = require('./config')

App({
  onLaunch() {
    console.log('App onLaunch')
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: config.cloudEnv,
      traceUser: true
    })

    this.globalData.settings = wx.getStorageSync('settings') || this.globalData.settings
    console.log('settings:', this.globalData.settings)

    // 检查是否需要显示新手引导
    const hasGuidance = wx.getStorageSync('hasGuidance')
    console.log('hasGuidance:', hasGuidance)
    
    if (!hasGuidance) {
      console.log('首次启动，显示引导页')
      wx.reLaunch({
        url: '/pages/guide/guide',
        fail: (err) => {
          console.error('reLaunch guide failed:', err)
          // 如果引导页加载失败，直接跳转到首页
          wx.switchTab({ url: '/pages/index/index' })
        }
      })
    } else {
      console.log('已显示过引导，跳转到首页')
      // 已显示过引导，直接跳转到首页（tabBar 页面）
      wx.switchTab({
        url: '/pages/index/index',
        fail: (err) => {
          console.error('switchTab index failed:', err)
        }
      })
    }
  },

  globalData: {
    openid: null,
    settings: {
      dailyCount: 25,
      playMode: 'manual',
      playSpeed: 1.0
    }
  }
})
