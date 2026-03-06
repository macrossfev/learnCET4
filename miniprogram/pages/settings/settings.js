const app = getApp()

Page({
  data: {
    dailyCountOptions: [10, 20, 30, 50, 100],
    dailyCountIndex: 1,  // 默认20
    playModeOptions: ['手动播放', '连续播放'],
    playModeIndex: 0,
    speedOptions: ['0.8x', '1.0x', '1.2x'],
    speedValues: [0.8, 1.0, 1.2],
    speedIndex: 1,
    cacheSize: '计算中...',
    version: '1.0.0'
  },

  onLoad() {
    const settings = app.globalData.settings
    this.setData({
      dailyCountIndex: this.data.dailyCountOptions.indexOf(settings.dailyCount),
      playModeIndex: settings.playMode === 'continuous' ? 1 : 0,
      speedIndex: this.data.speedValues.indexOf(settings.playSpeed)
    })
    this.calcCacheSize()
  },

  onDailyCountChange(e) {
    const index = e.detail.value
    const count = this.data.dailyCountOptions[index]
    this.setData({ dailyCountIndex: index })
    this.saveSetting('dailyCount', count)
  },

  onPlayModeChange(e) {
    const index = e.detail.value
    const mode = index == 1 ? 'continuous' : 'manual'
    this.setData({ playModeIndex: index })
    this.saveSetting('playMode', mode)
  },

  onSpeedChange(e) {
    const index = e.detail.value
    const speed = this.data.speedValues[index]
    this.setData({ speedIndex: index })
    this.saveSetting('playSpeed', speed)
  },

  saveSetting(key, value) {
    app.globalData.settings[key] = value
    wx.setStorageSync('settings', app.globalData.settings)
  },

  async calcCacheSize() {
    try {
      const res = wx.getStorageInfoSync()
      this.setData({ cacheSize: (res.currentSize / 1024).toFixed(1) + ' MB' })
    } catch (e) {
      this.setData({ cacheSize: '未知' })
    }
  },

  clearCache() {
    wx.showModal({
      title: '确认清除',
      content: '将清除所有本地缓存的音频文件和临时数据',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          // 恢复默认设置
          app.globalData.settings = { dailyCount: 20, playMode: 'manual', playSpeed: 1.0 }
          this.onLoad()
          wx.showToast({ title: '缓存已清除', icon: 'success' })
        }
      }
    })
  }
})
