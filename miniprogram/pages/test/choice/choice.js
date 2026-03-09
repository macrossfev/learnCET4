/**
 * 选择测试页面
 */
const db = require('../../../utils/db')
const { handleError } = require('../../../utils/error')
const { shuffle, getRandomItems, safePercent } = require('../../../utils/common')
const constants = require('../../../utils/constants')

Page({
  data: {
    questions: [],
    currentIndex: 0,
    selectedOption: -1,
    answered: false,
    score: 0,
    finished: false,
    accuracy: 0,
    progressId: '',
    isErrorMode: false
  },

  _loadStartTime: 0,

  onLoad(options) {
    this._loadStartTime = Date.now()
    this.unitFromUrl = options.unit ? parseInt(options.unit) : null
    this.isErrorMode = options.errorMode === 'true'
    this.errorWords = options.words ? options.words.split(',') : []
    this.loadQuestions()
  },

  async loadQuestions() {
    wx.showLoading({ title: '出题中...' })
    try {
      const app = getApp()
      const level = app.globalData.settings.level || 'CET4'
      const dailyCount = app.globalData.settings.dailyCount || constants.DEFAULT_DAILY_COUNT
      
      this.setData({ isErrorMode: this.isErrorMode })

      if (this.isErrorMode) {
        if (!this.errorWords || this.errorWords.length === 0) {
          wx.hideLoading()
          wx.showToast({ title: '暂无错题', icon: 'none' })
          return
        }
        const result = await db.getWordsByRange(level, 1, 3393)
        const allWords = result.words || []
        const words = allWords.filter(w => this.errorWords.includes(w.word))
        
        if (words.length === 0) {
          wx.hideLoading()
          wx.showToast({ title: '单词不存在', icon: 'none' })
          return
        }
        
        const questions = this.generateQuestions(words)
        this.setData({ questions })
        wx.hideLoading()
        this._recordLoadTime()
        return
      }

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

      const questions = this.generateQuestions(words)
      this.setData({ questions })
      wx.hideLoading()
      this._recordLoadTime()
    } catch (err) {
      handleError(err, '加载失败')
    }
  },

  _recordLoadTime() {
    const loadTime = Date.now() - this._loadStartTime
    if (loadTime > 3000) {
      console.warn('页面加载过慢:', loadTime, 'ms')
    }
  },

  generateQuestions(words) {
    const questions = words.map((word) => {
      const otherWords = words.filter((w) => w.word !== word.word)
      const distractors = getRandomItems(otherWords, constants.CHOICE_DISTRACTOR_COUNT).map(w => w.meaning)
      const options = shuffle([word.meaning, ...distractors])
      const correctIndex = options.indexOf(word.meaning)

      return {
        word: word.word,
        phonetic: word.phonetic || '',
        correctAnswer: word.meaning,
        correctIndex: correctIndex,
        options: options
      }
    })

    return shuffle(questions)
  },

  selectOption(e) {
    if (this.data.answered) return

    const optionIndex = e.currentTarget.dataset.index
    const { questions, currentIndex, score } = this.data
    const question = questions[currentIndex]
    const isCorrect = optionIndex === question.correctIndex

    this.setData({
      selectedOption: optionIndex,
      answered: true,
      score: isCorrect ? score + 1 : score
    })
  },

  nextQuestion() {
    const { currentIndex, questions } = this.data
    const nextIndex = currentIndex + 1

    if (nextIndex >= questions.length) {
      const accuracy = safePercent(this.data.score, questions.length)
      this.setData({ finished: true, accuracy })
      this.saveScore()
    } else {
      this.setData({
        currentIndex: nextIndex,
        selectedOption: -1,
        answered: false
      })
    }
  },

  async saveScore() {
    const { progressId, score, questions } = this.data
    if (!progressId) return
    try {
      await db.updateTestScore(progressId, score, questions.length)
    } catch (err) {
      handleError(err, '保存成绩失败', { showToast: false })
    }
  },

  restartTest() {
    this.setData({
      currentIndex: 0,
      selectedOption: -1,
      answered: false,
      score: 0,
      finished: false
    })
    this.loadQuestions()
  },

  goBack() {
    wx.navigateBack()
  }
})
