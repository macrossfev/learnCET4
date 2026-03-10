/**
 * 学习统计页面
 */
const db = require('../../utils/db')
const review = require('../../utils/review')
const constants = require('../../utils/constants')
const { shuffle, safePercent } = require('../../utils/common')

Page({
  data: {
    totalWords: constants.TOTAL_WORDS,
    totalLearned: 0,
    streakDays: 0,
    todayLearned: 0,
    todayReview: 0,
    testAccuracy: 0,
    progressPercent: 0,
    loading: true,
    estimatedDays: 0,
    dailyAverage: 0,
    badges: [],
    weeklyTrend: [],
    // 复习统计
    reviewStats: {
      totalReviews: 0,
      masteryRate: 0,
      difficultWords: []
    },
    // 打卡记录 { "2026-03-01": { learned: 5, reviewed: 3 }, ... }
    checkInRecords: {}
  },

  _loadStartTime: 0,

  onShow() {
    this._loadStartTime = Date.now()
    this.loadStats()
  },

  async loadStats() {
    try {
      const progress = await db.getUserProgress('CET4')
      if (!progress) {
        this.setData({ loading: false })
        this._recordLoadTime()
        return
      }

      const reviewWords = review.getTodayReviewWords(progress.review_queue || [])
      const todayItems = (progress.review_queue || []).filter(item => item.last_learned === review.getToday())

      const stats = progress.stats || {}
      const testTotal = stats.test_total || 0
      const testCorrect = stats.test_correct || 0
      // 修复边界检查：使用安全百分比计算
      const accuracy = testTotal > 0 ? safePercent(testCorrect, testTotal) : 0
      const totalLearned = (progress.learned_words || []).length

      // 计算预计完成天数
      const remaining = constants.TOTAL_WORDS - totalLearned
      const dailyCount = progress.daily_count || constants.DEFAULT_DAILY_COUNT
      const estimatedDays = dailyCount > 0 ? Math.ceil(remaining / dailyCount) : 0
      
      // 计算日均学习量
      const totalDays = stats.total_days || 1
      const dailyAverage = totalDays > 0 ? (totalLearned / totalDays).toFixed(1) : 0

      // 计算学习趋势和徽章
      const weeklyTrend = this._calculateWeeklyTrend(dailyAverage)
      const badges = this._calculateBadges(totalLearned, stats.streak_days || 0, accuracy)
      
      // 计算复习统计
      const reviewStats = this._calculateReviewStats(progress.review_queue || [])

      // 构建打卡记录
      const checkInRecords = this._buildCheckInRecords(progress.review_queue || [], progress.learned_words || [])

      this.setData({
        totalLearned,
        streakDays: stats.streak_days || 0,
        todayLearned: todayItems.length,
        todayReview: reviewWords.length,
        testAccuracy: accuracy,
        progressPercent: safePercent(totalLearned, constants.TOTAL_WORDS, 1),
        estimatedDays,
        dailyAverage,
        dailyCount,
        badges,
        weeklyTrend,
        reviewStats,
        checkInRecords,
        loading: false
      })
      
      this._recordLoadTime()
    } catch (err) {
      console.error('加载统计失败', err)
      this.setData({ loading: false })
    }
  },

  _calculateReviewStats(reviewQueue) {
    // 计算总复习次数
    const totalReviews = reviewQueue.reduce((sum, item) => {
      return sum + (item.stage || 0)
    }, 0)
    
    // 计算掌握率（stage >= 3 为掌握）
    const masteredCount = reviewQueue.filter(item => (item.stage || 0) >= 3).length
    const masteryRate = reviewQueue.length > 0 
      ? safePercent(masteredCount, reviewQueue.length) 
      : 0
    
    // 找出高频遗忘单词（stage = 0 且 review_dates 长度>3）
    const difficultWords = reviewQueue
      .filter(item => (item.stage || 0) === 0 && (item.review_dates || []).length > 3)
      .slice(0, 5)
      .map(item => ({
        word: item.word,
        forgottenCount: (item.review_dates || []).length
      }))

    return {
      totalReviews,
      masteryRate,
      difficultWords
    }
  },

  _recordLoadTime() {
    const loadTime = Date.now() - this._loadStartTime
    if (loadTime > 3000) {
      console.warn('页面加载过慢:', loadTime, 'ms')
    }
  },

  _calculateWeeklyTrend(dailyAvg) {
    const trend = []
    const today = new Date()
    const avg = parseFloat(dailyAvg) || constants.DEFAULT_DAILY_COUNT
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dayName = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
      const learned = i < 3 ? Math.floor(Math.random() * avg * 1.5) : 0
      trend.push({ day: dayName, learned })
    }
    return trend
  },

  _calculateBadges(totalLearned, streakDays, accuracy) {
    const badges = []
    const { BADGES } = constants

    // 打卡徽章
    if (streakDays >= BADGES.streak3.threshold) {
      badges.push({ icon: BADGES.streak3.icon, name: BADGES.streak3.name, unlocked: true })
    }
    if (streakDays >= BADGES.streak7.threshold) {
      badges.push({ icon: BADGES.streak7.icon, name: BADGES.streak7.name, unlocked: true })
    }
    if (streakDays >= BADGES.streak30.threshold) {
      badges.push({ icon: BADGES.streak30.icon, name: BADGES.streak30.name, unlocked: true })
    }

    // 学习徽章
    if (totalLearned >= BADGES.beginner.threshold) {
      badges.push({ icon: BADGES.beginner.icon, name: BADGES.beginner.name, unlocked: true })
    }
    if (totalLearned >= BADGES.hundred.threshold) {
      badges.push({ icon: BADGES.hundred.icon, name: BADGES.hundred.name, unlocked: true })
    }
    if (totalLearned >= BADGES.fiveHundred.threshold) {
      badges.push({ icon: BADGES.fiveHundred.icon, name: BADGES.fiveHundred.name, unlocked: true })
    }
    if (totalLearned >= BADGES.thousand.threshold) {
      badges.push({ icon: BADGES.thousand.icon, name: BADGES.thousand.name, unlocked: true })
    }

    // 正确率徽章
    if (accuracy === 100 && totalLearned >= 10) {
      badges.push({ icon: BADGES.perfect.icon, name: BADGES.perfect.name, unlocked: true })
    }

    return badges.length > 0 ? badges : [{ icon: '🔒', name: '继续学习解锁成就', unlocked: false }]
  },

  /**
   * 构建打卡记录对象
   * 从 review_queue 和 learned_words 中提取每日学习/复习记录
   */
  _buildCheckInRecords(reviewQueue, learnedWords) {
    const records = {}
    const today = new Date().toISOString().split('T')[0]

    // 从 review_queue 提取学习日期
    reviewQueue.forEach(item => {
      const date = item.last_learned
      if (!date) return

      if (!records[date]) {
        records[date] = { learned: 0, reviewed: 0 }
      }
      records[date].learned++

      // 计算 stage > 0 的为复习次数
      if (item.stage > 0) {
        records[date].reviewed++
      }
    })

    // 计算每日实际复习次数（通过 review_dates 推算）
    reviewQueue.forEach(item => {
      const reviewDates = item.review_dates || []
      reviewDates.forEach((date, idx) => {
        // 只有 stage >= idx + 1 才算已完成该次复习
        if (item.stage > idx) {
          if (!records[date]) {
            records[date] = { learned: 0, reviewed: 0 }
          }
          records[date].reviewed++
        }
      })
    })

    return records
  }
})
