const db = require('../../utils/db')
const review = require('../../utils/review')

Page({
  data: {
    words: [],
    reviewItems: [],
    currentIndex: 0,
    progressId: '',
    completed: false
  },

  onLoad() {
    this.loadReviewList()
  },

  async loadReviewList() {
    wx.showLoading({ title: '加载中...' })
    try {
      const app = getApp()
      const level = app.globalData.settings.level || 'CET4'
      const progress = await db.getUserProgress(level)
      if (!progress) {
        wx.hideLoading()
        this.setData({ completed: true })
        return
      }

      this.setData({ progressId: progress._id })

      const result = await db.getReviewList()
      if (!result || !result.words || result.words.length === 0) {
        this.setData({ completed: true })
        wx.hideLoading()
        return
      }

      this.setData({
        words: result.words,
        reviewItems: progress.review_queue || [],
        currentIndex: 0,
        completed: false
      })
    } catch (err) {
      console.error('加载复习列表失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async onRemembered() {
    await this._updateReview(true)
  },

  async onForgot() {
    await this._updateReview(false)
  },

  async _updateReview(remembered) {
    const { currentIndex, words, progressId, reviewItems } = this.data
    if (currentIndex >= words.length) return

    const word = words[currentIndex].word
    try {
      await db.updateReviewResult(progressId, word, remembered, reviewItems)
      // 同步更新本地 reviewItems，避免后续调用使用过期数据
      const today = new Date().toISOString().split('T')[0]
      const updatedItems = reviewItems.map(item => {
        if (item.word !== word) return item
        if (remembered) {
          const nextStage = item.stage + 1
          return {
            ...item,
            stage: nextStage,
            next_review: nextStage >= item.review_dates.length ? null : item.review_dates[nextStage]
          }
        } else {
          const intervals = [1, 3, 7, 14, 30]
          const reviewDates = intervals.map(d => {
            const date = new Date()
            date.setDate(date.getDate() + d)
            return date.toISOString().split('T')[0]
          })
          return { ...item, last_learned: today, review_dates: reviewDates, next_review: reviewDates[0], stage: 0 }
        }
      })
      this.setData({ reviewItems: updatedItems })
    } catch (err) {
      console.error('更新复习结果失败', err)
    }
    this.next()
  },

  next() {
    const { currentIndex, words } = this.data
    const nextIndex = currentIndex + 1
    if (nextIndex >= words.length) {
      this.setData({ completed: true })
    } else {
      this.setData({ currentIndex: nextIndex })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})
