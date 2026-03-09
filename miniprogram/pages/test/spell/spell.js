/**
 * 默写测试页面
 */
const db = require('../../../utils/db')
const audio = require('../../../utils/audio')
const { handleError } = require('../../../utils/error')
const { shuffle, safePercent } = require('../../../utils/common')
const constants = require('../../../utils/constants')

Page({
  data: {
    words: [],
    currentIndex: 0,
    inputValue: '',
    answered: false,
    isCorrect: false,
    diffChars: [],
    score: 0,
    finished: false,
    accuracy: 0,
    hintShown: false,
    hintText: '',
    progressId: ''
  },

  _loadStartTime: 0,

  onLoad(options) {
    this._loadStartTime = Date.now()
    this.unitFromUrl = options.unit ? parseInt(options.unit) : null
    this.loadWords()
  },

  onUnload() {
    audio.stop()
    this._recordLoadTime()
  },

  _recordLoadTime() {
    const loadTime = Date.now() - this._loadStartTime
    if (loadTime > 3000) {
      console.warn('页面加载过慢:', loadTime, 'ms')
    }
  },

  async loadWords() {
    wx.showLoading({ title: '加载中...' })
    try {
      const app = getApp()
      const level = app.globalData.settings.level || 'CET4'
      const dailyCount = app.globalData.settings.dailyCount || constants.DEFAULT_DAILY_COUNT
      const progress = await db.getUserProgress(level)

      if (!progress || !progress.learned_words || progress.learned_words.length === 0) {
        wx.hideLoading()
        wx.showToast({ title: '暂无已学单词', icon: 'none' })
        return
      }

      this.setData({ progressId: progress._id })

      const currentUnit = this.unitFromUrl || progress.current_unit || 1
      const startRank = (currentUnit - 1) * dailyCount + 1
      const endRank = currentUnit * dailyCount
      const result = await db.getWordsByRange(level, startRank, endRank)
      const words = result.words || []

      if (words.length === 0) {
        wx.hideLoading()
        wx.showToast({ title: '暂无可测试单词', icon: 'none' })
        return
      }

      const shuffled = shuffle(words)
      this.setData({ words: shuffled })
      wx.hideLoading()
    } catch (err) {
      handleError(err, '加载失败')
    }
  },

  onInputChange(e) {
    this.setData({ inputValue: e.detail.value })
  },

  checkSpelling() {
    const { words, currentIndex, inputValue, score } = this.data
    if (!inputValue.trim()) {
      wx.showToast({ title: '请输入单词', icon: 'none' })
      return
    }

    const correctWord = words[currentIndex].word
    const userInput = inputValue.trim().toLowerCase()
    const correct = correctWord.toLowerCase()
    const isCorrect = userInput === correct

    const maxLen = Math.max(userInput.length, correct.length)
    const diffChars = []
    for (let i = 0; i < maxLen; i++) {
      const userChar = i < userInput.length ? userInput[i] : ''
      const correctChar = i < correct.length ? correct[i] : ''
      diffChars.push({
        char: correctChar,
        userChar: userChar,
        isCorrect: userChar === correctChar.toLowerCase()
      })
    }

    this.setData({
      answered: true,
      isCorrect,
      diffChars,
      score: isCorrect ? score + 1 : score
    })
  },

  showHint() {
    const { words, currentIndex } = this.data
    const word = words[currentIndex].word
    this.setData({
      hintShown: true,
      hintText: word[0] + '...'
    })
  },

  playWord() {
    const { words, currentIndex } = this.data
    const word = words[currentIndex]
    if (word && word.audio && word.audio.word) {
      audio.playSingle(word.audio.word)
    }
  },

  nextQuestion() {
    const { currentIndex, words } = this.data
    const nextIndex = currentIndex + 1

    if (nextIndex >= words.length) {
      const accuracy = safePercent(this.data.score, words.length)
      this.setData({ finished: true, accuracy })
      this.saveScore()
    } else {
      this.setData({
        currentIndex: nextIndex,
        inputValue: '',
        answered: false,
        isCorrect: false,
        diffChars: [],
        hintShown: false,
        hintText: ''
      })
    }
  },

  async saveScore() {
    const { progressId, score, words } = this.data
    if (!progressId) return
    try {
      await db.updateTestScore(progressId, score, words.length)
    } catch (err) {
      handleError(err, '保存成绩失败', { showToast: false })
    }
  },

  restartTest() {
    this.setData({
      currentIndex: 0,
      inputValue: '',
      answered: false,
      isCorrect: false,
      diffChars: [],
      score: 0,
      finished: false,
      hintShown: false,
      hintText: ''
    })
    this.loadWords()
  },

  goBack() {
    wx.navigateBack()
  }
})
