const db = require('../../utils/db')
const audio = require('../../utils/audio')
const review = require('../../utils/review')

Page({
  data: {
    words: [],
    currentIndex: 0,
    progress: null,
    todayLearned: [],
    unit: 1,
    isContinuousMode: false,
    allDone: false,
    // Quiz state
    phase: 'learn', // learn | choice | spell | result
    choiceOptions: [],
    choiceSelected: -1,
    choiceCorrect: false,
    spellInput: '',
    spellCorrect: false,
    quizPassed: false
  },

  _touchStartX: 0,
  _touchStartY: 0,

  onLoad(options) {
    const unit = parseInt(options.unit) || 1
    const settings = getApp().globalData.settings
    const isContinuousMode = settings.playMode === 'continuous'
    this.setData({ unit, isContinuousMode })
    this.loadWords(unit)
  },

  onUnload() {
    audio.stop()
  },

  async loadWords(unit) {
    try {
      wx.showLoading({ title: '加载中...' })
      const settings = getApp().globalData.settings
      const dailyCount = settings.dailyCount
      const { startRank, endRank } = review.getUnitRange(unit, dailyCount)

      const level = 'CET4'
      const result = await db.getWordsByRange(level, startRank, endRank)
      const words = result.words || []

      let progress = await db.getUserProgress(level)
      if (!progress) {
        progress = await db.initUserProgress(level)
      }

      const learnedSet = new Set(progress.learned_words || [])
      const unlearnedWords = words.filter(w => !learnedSet.has(w.word))

      if (unlearnedWords.length === 0) {
        this.setData({ words: [], allDone: true, progress })
        wx.hideLoading()
        wx.showModal({
          title: '本单元已完成',
          content: '你已掌握本单元全部单词，是否返回首页？',
          confirmText: '返回首页',
          cancelText: '留在此页',
          success: (res) => {
            if (res.confirm) wx.navigateBack()
          }
        })
        return
      }

      this.setData({
        words: unlearnedWords,
        currentIndex: 0,
        progress,
        todayLearned: [],
        allDone: false,
        phase: 'learn'
      })
      wx.hideLoading()
    } catch (err) {
      wx.hideLoading()
      console.error('加载单词失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // Swipe handlers
  onTouchStart(e) {
    this._touchStartX = e.touches[0].clientX
    this._touchStartY = e.touches[0].clientY
  },

  onTouchEnd(e) {
    if (this.data.phase !== 'learn') return
    const deltaX = e.changedTouches[0].clientX - this._touchStartX
    const deltaY = e.changedTouches[0].clientY - this._touchStartY
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY)) return

    if (deltaX < 0) {
      // 向左划 → 上一词
      this.prevWord()
    } else {
      // 向右划 → 下一词
      this.nextWord()
    }
  },

  prevWord() {
    if (this.data.currentIndex <= 0) {
      wx.showToast({ title: '已是第一个', icon: 'none' })
      return
    }
    audio.stop()
    this.setData({ currentIndex: this.data.currentIndex - 1, phase: 'learn' })
  },

  nextWord() {
    const { currentIndex, words } = this.data
    if (currentIndex >= words.length - 1) return
    audio.stop()
    this.setData({ currentIndex: currentIndex + 1, phase: 'learn' })
  },

  // Start quiz for current word
  startQuiz() {
    audio.stop()
    const { words, currentIndex } = this.data
    const currentWord = words[currentIndex]
    const options = this._generateChoices(currentWord, words)

    this.setData({
      phase: 'choice',
      choiceOptions: options,
      choiceSelected: -1,
      choiceCorrect: false,
      spellInput: '',
      spellCorrect: false,
      quizPassed: false
    })
  },

  _generateChoices(currentWord, allWords) {
    const others = allWords.filter(w => w.word !== currentWord.word)
    // Fisher-Yates shuffle and pick 3
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]]
    }
    const wrongItems = others.slice(0, 3)

    const options = [
      { meaning: currentWord.meaning, correct: true },
      ...wrongItems.map(w => ({ meaning: w.meaning, correct: false }))
    ]
    // Shuffle options
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]]
    }
    return options
  },

  onChoiceSelect(e) {
    if (this.data.choiceSelected >= 0) return
    const index = e.currentTarget.dataset.index
    const option = this.data.choiceOptions[index]
    const correct = option.correct

    this.setData({
      choiceSelected: index,
      choiceCorrect: correct
    })

    if (!correct) {
      const currentWord = this.data.words[this.data.currentIndex]
      this._saveError(currentWord, 'choice', option.meaning, currentWord.meaning)
    }

    setTimeout(() => {
      this.setData({ phase: 'spell' })
    }, 1200)
  },

  onSpellInput(e) {
    this.setData({ spellInput: e.detail.value })
  },

  onSpellSubmit() {
    const { words, currentIndex, spellInput, choiceCorrect } = this.data
    if (!spellInput.trim()) return

    const currentWord = words[currentIndex]
    const input = spellInput.trim().toLowerCase()
    const expected = currentWord.word.toLowerCase()
    const isCorrect = input === expected
    const quizPassed = choiceCorrect && isCorrect

    this.setData({
      spellCorrect: isCorrect,
      phase: 'result',
      quizPassed
    })

    if (!isCorrect) {
      this._saveError(currentWord, 'spell', input, expected)
    }

    if (quizPassed) {
      this._doMarkMastered()
    }
  },

  _saveError(word, type, userAnswer, correctAnswer) {
    const today = new Date().toISOString().split('T')[0]
    const errorBook = wx.getStorageSync('error_book') || {}
    if (!errorBook[today]) errorBook[today] = []
    errorBook[today].push({
      word: word.word,
      meaning: word.meaning,
      type,
      userAnswer: userAnswer || '',
      correctAnswer,
      timestamp: Date.now()
    })
    wx.setStorageSync('error_book', errorBook)
  },

  async _doMarkMastered() {
    const { words, currentIndex, progress, todayLearned } = this.data
    const currentWord = words[currentIndex]
    if (!currentWord || !progress) return

    try {
      await db.markWordLearned(
        progress._id,
        currentWord.word,
        progress.learned_words || [],
        progress.review_queue || []
      )
      const newLearnedWords = [...(progress.learned_words || []), currentWord.word]
      const newTodayLearned = [...todayLearned, currentWord.word]
      const newProgress = { ...progress, learned_words: newLearnedWords }

      this.setData({
        progress: newProgress,
        todayLearned: newTodayLearned
      })
    } catch (err) {
      console.error('标记失败', err)
    }
  },

  goNextAfterQuiz() {
    const { currentIndex, words } = this.data
    if (currentIndex >= words.length - 1) {
      this.onAllDone()
    } else {
      audio.stop()
      this.setData({
        currentIndex: currentIndex + 1,
        phase: 'learn'
      })
    }
  },

  // 连续播放模式下自动进入测试
  onSequenceComplete() {
    if (!this.data.isContinuousMode) return
    setTimeout(() => {
      this.startQuiz()
    }, 600)
  },

  async onAllDone() {
    this.setData({ allDone: true })

    const { progress, unit } = this.data
    if (progress) {
      try {
        const today = review.getToday()
        const stats = progress.stats || {}
        const streakDays = review.calcStreak(stats.last_learn_date, stats.streak_days || 0)
        await db.updateProgress(progress._id, {
          current_unit: unit + 1,
          stats: {
            streak_days: streakDays,
            last_learn_date: today,
            total_days: (stats.total_days || 0) + (stats.last_learn_date === today ? 0 : 1)
          }
        })
      } catch (err) {
        console.error('更新单元进度失败', err)
      }
    }

    wx.showModal({
      title: '学习完成',
      content: '本单元学习结束，共掌握 ' + this.data.todayLearned.length + ' 个新词。',
      confirmText: '返回首页',
      cancelText: '留在此页',
      success: (res) => {
        if (res.confirm) wx.navigateBack()
      }
    })
  }
})
