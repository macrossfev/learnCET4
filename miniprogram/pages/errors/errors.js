const db = require('../../utils/db')
const constants = require('../../utils/constants')

Page({
  data: {
    errorDays: [],
    expandedDate: '',
    masteringWord: null,
    showTestOptions: false,
    // 智能分类
    errorStats: {
      total: 0,
      choice: 0,
      spell: 0,
      recent: 0
    },
    // 推荐练习
    recommendedWords: []
  },

  onShow() {
    this.loadErrors()
    this._calculateStats()
    this._generateRecommendations()
  },

  loadErrors() {
    let errorBook = wx.getStorageSync('error_book') || {}
    
    // Migrate old format to new format with mastered field
    let migrated = false
    Object.keys(errorBook).forEach(date => {
      errorBook[date].forEach(err => {
        if (err.mastered === undefined) {
          err.mastered = false
          migrated = true
        }
      })
    })
    if (migrated) {
      wx.setStorageSync('error_book', errorBook)
    }

    // Filter out mastered errors
    const days = Object.keys(errorBook).sort().reverse().map(date => {
      const unmasteredErrors = errorBook[date].filter(err => !err.mastered)
      return {
        date,
        errors: unmasteredErrors,
        count: unmasteredErrors.length,
        totalCount: errorBook[date].length
      }
    }).filter(day => day.count > 0)

    this.setData({ errorDays: days })
  },

  _calculateStats() {
    const errorBook = wx.getStorageSync('error_book') || {}
    let total = 0, choice = 0, spell = 0, recent = 0
    const today = new Date().toISOString().split('T')[0]
    
    Object.keys(errorBook).forEach(date => {
      errorBook[date].forEach(err => {
        if (!err.mastered) {
          total++
          if (err.type === 'choice') choice++
          if (err.type === 'spell') spell++
          if (date === today) recent++
        }
      })
    })
    
    this.setData({
      errorStats: { total, choice, spell, recent }
    })
  },

  _generateRecommendations() {
    const errorBook = wx.getStorageSync('error_book') || {}
    const wordFreq = {}
    
    // 统计每个单词的错误次数
    Object.keys(errorBook).forEach(date => {
      errorBook[date].forEach(err => {
        if (!err.mastered) {
          wordFreq[err.word] = (wordFreq[err.word] || 0) + 1
        }
      })
    })
    
    // 按错误次数排序，取前 10 个
    const recommended = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }))
    
    this.setData({ recommendedWords: recommended })
  },

  toggleDate(e) {
    const date = e.currentTarget.dataset.date
    this.setData({
      expandedDate: this.data.expandedDate === date ? '' : date
    })
  },

  // Add error to review queue
  async addToReview(e) {
    const { word, date, index } = e.currentTarget.dataset
    wx.showLoading({ title: '添加中...' })
    
    try {
      const level = 'CET4'
      const progress = await db.getUserProgress(level)
      if (!progress) {
        wx.hideLoading()
        wx.showToast({ title: '请先开始学习', icon: 'none' })
        return
      }

      const today = new Date().toISOString().split('T')[0]
      const intervals = [1, 3, 7, 14, 30]
      const reviewDates = intervals.map(d => {
        const date = new Date()
        date.setDate(date.getDate() + d)
        return date.toISOString().split('T')[0]
      })

      // Check if already in review queue
      const exists = progress.review_queue.some(item => item.word === word)
      if (!exists) {
        const newReviewItem = {
          word,
          last_learned: today,
          review_dates: reviewDates,
          next_review: reviewDates[0],
          stage: 0
        }
        const newReviewQueue = [...progress.review_queue, newReviewItem]
        
        await db.updateProgress(progress._id, {
          review_queue: newReviewQueue
        })
      }

      wx.hideLoading()
      wx.showToast({ title: '已加入复习', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('加入复习失败', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  // Mark error as mastered
  async markMastered(e) {
    const { word, date, index } = e.currentTarget.dataset
    
    this.setData({ masteringWord: { word, date, index } })
  },

  confirmMarkMastered() {
    const { masteringWord } = this.data
    if (!masteringWord) return

    const { word, date, index } = masteringWord
    const errorBook = wx.getStorageSync('error_book') || {}
    
    if (errorBook[date]) {
      const errIndex = errorBook[date].findIndex(err => err.word === word && err.timestamp === index)
      if (errIndex >= 0) {
        errorBook[date][errIndex].mastered = true
        wx.setStorageSync('error_book', errorBook)
        this.loadErrors()
        wx.showToast({ title: '已标记为掌握', icon: 'success' })
      }
    }
    
    this.setData({ masteringWord: null })
  },

  cancelMarkMastered() {
    this.setData({ masteringWord: null })
  },

  // Test errors for a specific date
  testErrors(e) {
    const { date } = e.currentTarget.dataset
    const errorBook = wx.getStorageSync('error_book') || {}
    const errors = errorBook[date] || []
    
    if (errors.length === 0) {
      wx.showToast({ title: '暂无错题', icon: 'none' })
      return
    }

    // Navigate to test page with error words
    const wordList = errors.map(err => err.word).join(',')
    wx.navigateTo({
      url: `/pages/test/choice/choice?errorMode=true&words=${wordList}`
    })
  },

  // Test all errors
  testAllErrors() {
    const errorBook = wx.getStorageSync('error_book') || {}
    const allErrors = []
    Object.keys(errorBook).forEach(date => {
      allErrors.push(...errorBook[date].filter(err => !err.mastered))
    })

    if (allErrors.length === 0) {
      wx.showToast({ title: '暂无错题', icon: 'none' })
      return
    }

    const wordList = allErrors.map(err => err.word).join(',')
    wx.navigateTo({
      url: `/pages/test/choice/choice?errorMode=true&words=${wordList}`
    })
  },

  clearAll() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有错题记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('error_book')
          this.setData({ errorDays: [] })
          wx.showToast({ title: '已清空', icon: 'success' })
        }
      }
    })
  }
})
