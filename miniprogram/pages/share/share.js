Page({
  data: {
    streakDays: 0,
    totalLearned: 0,
    todayLearned: 0,
    shareDate: '',
    posterReady: false
  },

  onLoad() {
    this.loadShareData()
  },

  async loadShareData() {
    try {
      const db = require('../../utils/db')
      const progress = await db.getUserProgress('CET4')
      
      if (!progress) {
        wx.showToast({ title: '暂无学习数据', icon: 'none' })
        return
      }

      const stats = progress.stats || {}
      const today = new Date().toISOString().split('T')[0]
      const todayItems = (progress.review_queue || []).filter(item => item.last_learned === today)

      this.setData({
        streakDays: stats.streak_days || 0,
        totalLearned: (progress.learned_words || []).length,
        todayLearned: todayItems.length,
        shareDate: today,
        posterReady: true
      })
    } catch (err) {
      console.error('加载分享数据失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // Share to WeChat moments
  onShareToMoments() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
    
    wx.showToast({
      title: '点击右上角分享',
      icon: 'none',
      duration: 2000
    })
  },

  // Copy text for sharing
  copyShareText() {
    const { streakDays, totalLearned, todayLearned } = this.data
    const text = `📚 我在「四级必过」小程序学习，已连续打卡 ${streakDays} 天，掌握了 ${totalLearned} 个单词！今天学了 ${todayLearned} 个词，一起加油！`
    
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success',
          duration: 1500
        })
      }
    })
  },

  // Share image (simplified version)
  shareImage() {
    wx.showToast({
      title: '截图分享更有效',
      icon: 'none',
      duration: 2000
    })
  }
})
