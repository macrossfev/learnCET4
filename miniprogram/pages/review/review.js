/**
 * 复习页面 - 增强版
 * 功能：回想模式 + 三级掌握程度 + 丰富反馈
 */
const db = require('../../utils/db')
const review = require('../../utils/review')
const constants = require('../../utils/constants')
const audio = require('../../utils/audio')
const { getToday } = require('../../utils/review')

Page({
  data: {
    words: [],
    reviewItems: [],
    currentIndex: 0,
    progressId: '',
    completed: false,
    
    // 回想模式
    showMeaning: false,  // 是否显示释义
    
    // 三级掌握程度
    masteryLevel: 0,  // 0=未选择，1=熟悉，2=模糊，3=遗忘
    
    // 反馈状态
    showFeedback: false,
    feedbackText: '',
    feedbackIcon: '',
    feedbackColor: '',
    
    // 统计数据
    rememberedCount: 0,
    unsureCount: 0,
    forgotCount: 0,
    
    // 复习模式
    reviewMode: 'normal'  // normal=普通，quick=快速，test=测试
  },

  _loadStartTime: 0,

  onLoad(options) {
    this._loadStartTime = Date.now()
    this.setData({
      reviewMode: options.mode || 'normal'
    })
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
        completed: false,
        showMeaning: false,
        masteryLevel: 0,
        rememberedCount: 0,
        unsureCount: 0,
        forgotCount: 0
      })
      wx.hideLoading()
      this._recordLoadTime()
    } catch (err) {
      console.error('加载复习列表失败', err)
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  _recordLoadTime() {
    const loadTime = Date.now() - this._loadStartTime
    if (loadTime > 3000) {
      console.warn('页面加载过慢:', loadTime, 'ms')
    }
  },

  // 显示释义（回想后查看）
  onShowMeaning() {
    this.setData({ showMeaning: true })
  },

  // 选择掌握程度
  onMasterySelect(e) {
    const { level } = e.currentTarget.dataset
    this.setData({ masteryLevel: level })
    
    const feedbackConfig = {
      1: { icon: '😍', text: '太棒了！', color: 'success' },
      2: { icon: '🙂', text: '再巩固下', color: 'warning' },
      3: { icon: '😕', text: '加入复习', color: 'error' }
    }
    
    const config = feedbackConfig[level]
    this._showFeedback(config)
    
    // 根据掌握程度更新复习
    this._updateReviewWithLevel(level)
  },

  // 重置当前词状态
  onResetWord() {
    this.setData({
      showMeaning: false,
      masteryLevel: 0
    })
  },

  _showFeedback(config) {
    this.setData({
      showFeedback: true,
      feedbackText: config.text,
      feedbackIcon: config.icon,
      feedbackColor: config.color
    })

    setTimeout(() => {
      this.setData({ showFeedback: false })
    }, 1200)
  },

  async _updateReviewWithLevel(level) {
    const { currentIndex, words, progressId } = this.data
    if (currentIndex >= words.length) return

    const word = words[currentIndex].word
    const today = getToday()
    
    // 根据掌握程度设置不同的复习间隔
    const intervalsMap = {
      1: [3, 7, 14, 30, 60],    // 熟悉：延长间隔
      2: [1, 3, 7, 14, 30],     // 模糊：标准间隔
      3: [1, 1, 3, 7, 14]       // 遗忘：缩短间隔
    }
    
    const intervals = intervalsMap[level] || intervalsMap[2]
    const reviewDates = intervals.map(d => {
      const date = new Date()
      date.setDate(date.getDate() + d)
      return date.toISOString().split('T')[0]
    })

    const newReviewItem = {
      word,
      last_learned: today,
      review_dates: reviewDates,
      next_review: reviewDates[0],
      stage: 0,
      mastery: level  // 记录掌握程度
    }

    // 更新复习队列
    const updatedQueue = this.data.reviewItems.filter(item => item.word !== word)
    updatedQueue.push(newReviewItem)

    try {
      await db.updateReviewResult(progressId, word, level >= 2, updatedQueue)
      this.setData({ reviewItems: updatedQueue })
      
      // 更新统计
      const statsMap = {
        1: 'rememberedCount',
        2: 'unsureCount',
        3: 'forgotCount'
      }
      const statKey = statsMap[level]
      this.setData({
        [statKey]: this.data[statKey] + 1
      })
      
      // 延迟进入下一个
      setTimeout(() => {
        this.next()
      }, 800)
    } catch (err) {
      console.error('更新复习结果失败', err)
      this.next()
    }
  },

  next() {
    const { currentIndex, words } = this.data
    const nextIndex = currentIndex + 1
    
    if (nextIndex >= words.length) {
      this._completeReview()
    } else {
      this.setData({
        currentIndex: nextIndex,
        showMeaning: false,
        masteryLevel: 0
      })
    }
  },

  _completeReview() {
    const { rememberedCount, unsureCount, forgotCount, words } = this.data
    const today = new Date().toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric'
    })
    
    this.setData({
      completed: true,
      rememberedCount,
      unsureCount,
      forgotCount,
      reviewDate: today
    })
  },

  // 计算掌握率
  _calculateMasteryRate() {
    const { rememberedCount, unsureCount, forgotCount } = this.data
    const total = rememberedCount + unsureCount + forgotCount
    if (total === 0) return 0
    // 熟悉算 100%，模糊算 50%，遗忘算 0%
    const score = rememberedCount + (unsureCount * 0.5)
    return Math.round((score / total) * 100)
  },

  // 获取复习建议
  _getSuggestion() {
    const { rememberedCount, unsureCount, forgotCount } = this.data
    const total = rememberedCount + unsureCount + forgotCount
    
    if (forgotCount > total * 0.5) {
      return '遗忘较多，建议明天再次复习这些单词'
    }
    if (unsureCount > total * 0.5) {
      return '模糊较多，建议重点巩固这些单词'
    }
    if (rememberedCount === total) {
      return '太棒了！全部掌握，继续保持'
    }
    return '复习效果不错，继续加油'
  },

  goBack() {
    wx.navigateBack()
  },

  // 跳过当前词
  onSkip() {
    this.next()
  },

  // 播放单词发音
  onPlayWord() {
    const { words, currentIndex } = this.data
    const word = words[currentIndex]
    if (word && word.audio && word.audio.word) {
      audio.playSingle(word.audio.word)
    }
  },

  onUnload() {
    audio.stop()
  }
})
