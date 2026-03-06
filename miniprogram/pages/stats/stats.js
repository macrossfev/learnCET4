const db = require('../../utils/db')
const review = require('../../utils/review')

Page({
  data: {
    totalWords: 1000,
    totalLearned: 0,
    streakDays: 0,
    todayLearned: 0,
    todayReview: 0,
    testAccuracy: 0,
    progressPercent: 0,
    loading: true
  },

  onShow() {
    this.loadStats()
  },

  async loadStats() {
    try {
      const progress = await db.getUserProgress('CET4')
      if (!progress) {
        this.setData({ loading: false })
        return
      }

      const reviewWords = review.getTodayReviewWords(progress.review_queue || [])
      const today = review.getToday()
      // 计算今日已学：检查learned_words中今日标记的（简化处理，从review_queue统计）
      const todayItems = (progress.review_queue || []).filter(item => item.last_learned === today)

      const stats = progress.stats || {}
      const testTotal = stats.test_total || 0
      const testCorrect = stats.test_correct || 0
      const accuracy = testTotal > 0 ? Math.round(testCorrect / testTotal * 100) : 0

      this.setData({
        totalLearned: (progress.learned_words || []).length,
        streakDays: stats.streak_days || 0,
        todayLearned: todayItems.length,
        todayReview: reviewWords.length,
        testAccuracy: accuracy,
        progressPercent: Math.round((progress.learned_words || []).length / this.data.totalWords * 1000) / 10,
        loading: false
      })
    } catch (err) {
      console.error('加载统计失败', err)
      this.setData({ loading: false })
    }
  }
})
