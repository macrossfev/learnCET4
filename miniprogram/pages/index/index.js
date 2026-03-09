const db = require('../../utils/db')
const review = require('../../utils/review')

const TOTAL_WORDS = 1000

Page({
  data: {
    todayLearned: 0,
    todayRemain: 0,
    reviewCount: 0,
    totalLearned: 0,
    totalPercent: 0,
    streakDays: 0,
    dailyCount: 20,
    progress: null
  },

  onShow() {
    this.loadProgress()
  },

  async loadProgress() {
    const app = getApp()
    const settings = app.globalData.settings
    const level = 'CET4' // 默认级别，后续可配置

    try {
      let progress = await db.getUserProgress(level)
      if (!progress) {
        progress = await db.initUserProgress(level)
      }

      const today = review.getToday()
      const learnedWords = progress.learned_words || []
      const reviewQueue = progress.review_queue || []
      const stats = progress.stats || {}
      const dailyCount = progress.daily_count || settings.dailyCount

      // 计算今日已学数量：筛选今日标记为已学的复习队列条目
      const todayLearnedItems = reviewQueue.filter(
        item => item.last_learned === today
      )
      const todayLearned = todayLearnedItems.length
      const todayRemain = Math.max(0, dailyCount - todayLearned)

      // 筛选今日待复习单词
      const todayReviewWords = review.getTodayReviewWords(reviewQueue)
      const reviewCount = todayReviewWords.length

      // 总进度
      const totalLearned = learnedWords.length
      const totalPercent = Math.min(
        100,
        Math.round((totalLearned / TOTAL_WORDS) * 100)
      )

      // 连续打卡天数
      const streakDays = stats.streak_days || 0

      this.setData({
        progress,
        todayLearned,
        todayRemain,
        reviewCount,
        totalLearned,
        totalPercent,
        streakDays,
        dailyCount
      })
    } catch (err) {
      console.error('加载进度失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  goLearn() {
    const progress = this.data.progress
    if (!progress) return

    const unit = progress.current_unit || 1
    wx.navigateTo({
      url: `/pages/learn/learn?unit=${unit}`
    })
  },

  goReview() {
    wx.navigateTo({
      url: '/pages/review/review'
    })
  },

  goErrors() {
    wx.navigateTo({
      url: '/pages/errors/errors'
    })
  },

  goShare() {
    wx.navigateTo({
      url: '/pages/share/share'
    })
  }
})
