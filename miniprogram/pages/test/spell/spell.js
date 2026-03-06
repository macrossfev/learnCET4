const db = require('../../../utils/db')
const audio = require('../../../utils/audio')

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

  onLoad(options) {
    this.unitFromUrl = options.unit ? parseInt(options.unit) : null
    this.loadWords()
  },

  onUnload() {
    audio.stop()
  },

  async loadWords() {
    wx.showLoading({ title: '加载中...' })
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

      // 优先使用URL传入的unit，否则取当前单元
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

      // 随机打乱顺序
      const shuffled = this.shuffle(words)
      this.setData({ words: shuffled })
    } catch (err) {
      console.error('加载单词失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  shuffle(arr) {
    const result = [...arr]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]]
    }
    return result
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

    // 逐字符比对，标记差异
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
      const accuracy = words.length > 0 ? Math.round(this.data.score / words.length * 100) : 0
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
      console.error('保存测试成绩失败', err)
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
