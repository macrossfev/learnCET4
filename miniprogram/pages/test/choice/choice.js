const db = require('../../../utils/db')

Page({
  data: {
    questions: [],
    currentIndex: 0,
    selectedOption: -1,
    answered: false,
    score: 0,
    finished: false,
    accuracy: 0,
    progressId: ''
  },

  onLoad(options) {
    this.unitFromUrl = options.unit ? parseInt(options.unit) : null
    this.loadQuestions()
  },

  async loadQuestions() {
    wx.showLoading({ title: '出题中...' })
    try {
      const app = getApp()
      const level = app.globalData.settings.level || 'CET4'
      const dailyCount = app.globalData.settings.dailyCount || 20
      const progress = await db.getUserProgress(level)

      if (!progress || !progress.learned_words || progress.learned_words.length === 0) {
        wx.hideLoading()
        wx.showToast({ title: '暂无已学单词', icon: 'none' })
        return
      }

      this.setData({ progressId: progress._id })

      // 优先使用URL传入的unit，否则取当前单元的前一个（刚学完的）
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
    } catch (err) {
      console.error('加载测试题目失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  generateQuestions(words) {
    const questions = words.map((word, index) => {
      // 从其他单词中随机选3个作为干扰项
      const otherWords = words.filter((_, i) => i !== index)
      const distractors = this.getRandomItems(otherWords, 3).map(w => w.meaning)
      const options = this.shuffle([word.meaning, ...distractors])
      const correctIndex = options.indexOf(word.meaning)

      return {
        word: word.word,
        phonetic: word.phonetic || '',
        correctAnswer: word.meaning,
        correctIndex: correctIndex,
        options: options
      }
    })

    return this.shuffle(questions)
  },

  getRandomItems(arr, count) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(count, shuffled.length))
  },

  shuffle(arr) {
    const result = [...arr]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]]
    }
    return result
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
      const accuracy = questions.length > 0 ? Math.round(this.data.score / questions.length * 100) : 0
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
      console.error('保存测试成绩失败', err)
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
