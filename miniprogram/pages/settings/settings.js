/**
 * 设置页面
 */
const app = getApp()
const audio = require('../../utils/audio')
const constants = require('../../utils/constants')
const tracking = require('../../utils/tracking')

Page({
  data: {
    dailyCountOptions: [10, 20, 30, 50, 100],
    dailyCountIndex: 1,  // 默认 20
    playModeOptions: ['手动播放', '连续播放'],
    playModeIndex: 0,
    speedOptions: ['0.8x', '1.0x', '1.2x'],
    speedValues: [0.8, 1.0, 1.2],
    speedIndex: 1,
    cacheSize: '计算中...',
    cacheCount: 0,
    cachePercent: 0,
    version: '1.0.0',
    // New features
    reviewReminder: false
  },

  onLoad() {
    const settings = app.globalData.settings
    this.setData({
      dailyCountIndex: this.data.dailyCountOptions.indexOf(settings.dailyCount),
      playModeIndex: settings.playMode === 'continuous' ? 1 : 0,
      speedIndex: this.data.speedValues.indexOf(settings.playSpeed),
      reviewReminder: wx.getStorageSync('reviewReminder') || false
    })
    this.updateCacheStats()

    // 埋点：页面访问
    tracking.trackPageView('settings')
  },

  onShow() {
    this.updateCacheStats()
  },

  updateCacheStats() {
    const stats = audio.getCacheStats()
    this.setData({
      cacheSize: this._formatSize(stats.totalSize),
      cacheCount: stats.count,
      cachePercent: stats.usedPercent
    })
  },

  _formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  },

  onDailyCountChange(e) {
    const index = e.detail.value
    const count = this.data.dailyCountOptions[index]
    this.setData({ dailyCountIndex: index })
    this.saveSetting('dailyCount', count)

    // 埋点：设置变更
    tracking.trackSettingChange('dailyCount', this.data.dailyCountOptions[this.data.dailyCountIndex], count)
  },

  onPlayModeChange(e) {
    const index = e.detail.value
    const mode = index == 1 ? 'continuous' : 'manual'
    this.setData({ playModeIndex: index })
    this.saveSetting('playMode', mode)

    // 埋点：设置变更
    tracking.trackSettingChange('playMode', this.data.playModeIndex === 0 ? 'manual' : 'continuous', mode)
  },

  onSpeedChange(e) {
    const index = e.detail.value
    const speed = this.data.speedValues[index]
    this.setData({ speedIndex: index })
    this.saveSetting('playSpeed', speed)

    // 埋点：设置变更
    tracking.trackSettingChange('playSpeed', this.data.speedValues[this.data.speedIndex], speed)
  },

  onReviewReminderChange(e) {
    const enabled = e.detail.value
    this.setData({ reviewReminder: enabled })
    wx.setStorageSync('reviewReminder', enabled)
    
    if (enabled) {
      wx.showToast({ title: '复习提醒已开启', icon: 'success' })
    } else {
      wx.showToast({ title: '复习提醒已关闭', icon: 'none' })
    }
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
      content: '将清除所有本地缓存的音频文件',
      success: (res) => {
        if (res.confirm) {
          audio.clearAllCache()
          this.updateCacheStats()
          wx.showToast({ title: '缓存已清除', icon: 'success' })
        }
      }
    })
  },

  // Backup learning data
  backupData() {
    wx.showLoading({ title: '生成备份...' })
    
    setTimeout(async () => {
      try {
        const progress = await this.getUserProgress()
        if (!progress) {
          wx.hideLoading()
          wx.showToast({ title: '暂无学习数据', icon: 'none' })
          return
        }

        const backupData = {
          version: this.data.version,
          backupTime: new Date().toISOString(),
          progress: progress
        }

        const backupStr = JSON.stringify(backupData, null, 2)
        wx.setClipboardData({
          data: backupStr,
          success: () => {
            wx.hideLoading()
            wx.showModal({
              title: '备份成功',
              content: '数据已复制到剪贴板，请粘贴保存到安全位置',
              showCancel: false
            })
          }
        })
      } catch (err) {
        wx.hideLoading()
        wx.showToast({ title: '备份失败', icon: 'none' })
        console.error('备份失败', err)
      }
    }, 500)
  },

  // Restore learning data
  restoreData() {
    wx.showModal({
      title: '恢复数据',
      content: '请粘贴之前备份的数据',
      editable: true,
      placeholderText: '粘贴备份数据...',
      success: (res) => {
        if (res.confirm && res.content) {
          try {
            const backupData = JSON.parse(res.content)
            if (!backupData.progress) {
              throw new Error('Invalid backup format')
            }
            
            wx.setStorageSync('restore_data', backupData.progress)
            wx.showModal({
              title: '恢复成功',
              content: '数据已恢复，请重启小程序',
              showCancel: false,
              success: () => {
                wx.reLaunch({ url: '/pages/index/index' })
              }
            })
          } catch (err) {
            wx.showToast({ title: '数据格式错误', icon: 'none' })
          }
        }
      }
    })
  },

  async getUserProgress() {
    const db = require('../../utils/db')
    return await db.getUserProgress('CET4')
  },

  // Open feedback
  openFeedback() {
    wx.showModal({
      title: '意见反馈',
      content: '请描述您遇到的问题或建议',
      editable: true,
      placeholderText: '请输入您的反馈...',
      success: (res) => {
        if (res.confirm && res.content) {
          // Save feedback locally (in production, send to server)
          const feedbacks = wx.getStorageSync('feedbacks') || []
          feedbacks.push({
            content: res.content,
            timestamp: Date.now(),
            status: 'submitted'
          })
          wx.setStorageSync('feedbacks', feedbacks)
          
          wx.showModal({
            title: '提交成功',
            content: '感谢您的反馈！我们会认真阅读每一条建议',
            showCancel: false
          })
        }
      }
    })
  }
})
