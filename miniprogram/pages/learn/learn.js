const db = require('../../utils/db')
const audio = require('../../utils/audio')
const review = require('../../utils/review')
const constants = require('../../utils/constants')
const tracking = require('../../utils/tracking')

Page({
  data: {
    words: [],
    currentIndex: 0,
    progress: null,
    todayLearned: [],
    unit: 1,
    allDone: false,
    // 当前步骤：1=单词展示, 2=选择题, 3=填词
    step: 1,
    // 选择题
    choiceOptions: [],
    choiceSelected: -1,
    choiceCorrect: false,
    choiceWrong: false,
    // 填词
    spellInput: '',
    spellWrong: false,
    spellHint: '',
    // 重点记忆集合
    focusWords: []
  },

  _touchStartX: 0,
  _touchStartY: 0,
  _autoSaveTimer: null,
  _loadStartTime: 0,
  _learnStartTime: 0,

  onLoad(options) {
    this._loadStartTime = Date.now()
    this._learnStartTime = Date.now()
    const unit = parseInt(options.unit) || 1
    this.setData({ unit })
    this.loadWords(unit)
    this._startAutoSave()

    // 加载重点记忆集合
    const focusWords = wx.getStorageSync('focus_words') || []
    this.setData({ focusWords })

    tracking.trackPageView('learn')
  },

  onUnload() {
    audio.stop()
    this._clearAutoSave()
  },

  onHide() {
    this._saveProgress()
  },

  _startAutoSave() {
    this._autoSaveTimer = setInterval(() => {
      this._saveProgress()
    }, constants.AUTO_SAVE_INTERVAL)
  },

  _clearAutoSave() {
    if (this._autoSaveTimer) {
      clearInterval(this._autoSaveTimer)
      this._autoSaveTimer = null
    }
  },

  async loadWords(unit) {
    try {
      wx.showLoading({ title: '加载中...' })
      const dailyCount = constants.DEFAULT_DAILY_COUNT
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
        step: 1,
        choiceSelected: -1,
        choiceCorrect: false,
        spellInput: '',
        spellWrong: false
      })
      wx.hideLoading()

      // 播放当前单词音频
      this._playCurrentWordAudio()

      tracking.trackLearnStart(unit, unlearnedWords.length)
    } catch (err) {
      wx.hideLoading()
      console.error('加载单词失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  _saveProgress() {
    const { unit, currentIndex, todayLearned } = this.data
    wx.setStorageSync('temp_learning_progress', {
      unit,
      currentIndex,
      todayLearnedCount: todayLearned.length,
      timestamp: Date.now()
    })
  },

  // 播放当前单词音频
  _playCurrentWordAudio() {
    const { words, currentIndex, step } = this.data
    if (!words[currentIndex]) return

    const word = words[currentIndex]
    if (step === 1 && word.audio) {
      audio.playWordSequence(word.audio)
    }
  },

  // ===== 滑动处理（页面间切换）=====
  onTouchStart(e) {
    this._touchStartX = e.touches[0].clientX
    this._touchStartY = e.touches[0].clientY
  },

  onTouchEnd(e) {
    const deltaX = e.changedTouches[0].clientX - this._touchStartX
    const deltaY = e.changedTouches[0].clientY - this._touchStartY
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY)) return

    if (deltaX > 0) {
      // 右滑 → 下一页（step+1）
      this.nextStep()
    } else {
      // 左滑 → 上一页（step-1）
      this.prevStep()
    }
  },

  prevStep() {
    const { step } = this.data
    if (step > 1) {
      this.setData({ step: step - 1, spellInput: '', spellWrong: false, choiceSelected: -1, choiceWrong: false })
    }
  },

  nextStep() {
    const { step } = this.data
    if (step < 3) {
      // 进入下一步前准备
      if (step === 1) {
        // 进入选择题
        this._prepareChoice()
      }
      audio.stop()
      this.setData({ step: step + 1, spellInput: '', spellWrong: false })
    }
  },

  _prepareChoice() {
    const { words, currentIndex } = this.data
    const currentWord = words[currentIndex]
    const options = this._generateChoices(currentWord, words)
    this.setData({
      choiceOptions: options,
      choiceSelected: -1,
      choiceCorrect: false,
      choiceWrong: false
    })
  },

  _generateChoices(currentWord, allWords) {
    const others = allWords.filter(w => w.word !== currentWord.word)
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]]
    }
    const wrongItems = others.slice(0, 3)

    const options = [
      { meaning: currentWord.meaning, correct: true },
      ...wrongItems.map(w => ({ meaning: w.meaning, correct: false }))
    ]
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]]
    }
    return options
  },

  // ===== 选择题 =====
  onChoiceSelect(e) {
    const index = e.currentTarget.dataset.index
    const option = this.data.choiceOptions[index]
    const correct = option.correct

    this.setData({
      choiceSelected: index,
      choiceCorrect: correct,
      choiceWrong: !correct
    })

    const currentWord = this.data.words[this.data.currentIndex]

    if (correct) {
      // 选对了，可以进入下一步
      tracking.trackQuizChoice(currentWord.word, true, option.meaning)
      setTimeout(() => {
        this.setData({ step: 3, spellInput: '', spellWrong: false })
      }, 800)
    } else {
      // 选错了，停留并记录
      tracking.trackQuizChoice(currentWord.word, false, option.meaning)
      this._saveError(currentWord, 'choice', option.meaning, currentWord.meaning)
      // 2秒后重置，让用户重选
      setTimeout(() => {
        this.setData({ choiceSelected: -1, choiceWrong: false })
      }, 1500)
    }
  },

  // ===== 填词 =====
  onSpellInput(e) {
    this.setData({ spellInput: e.detail.value, spellWrong: false })
  },

  onSpellSubmit() {
    const { words, currentIndex, spellInput } = this.data
    if (!spellInput.trim()) return

    const currentWord = words[currentIndex]
    const input = spellInput.trim().toLowerCase()
    const expected = currentWord.word.toLowerCase()
    const isCorrect = input === expected

    if (isCorrect) {
      // 填对了，标记掌握并进入下一词
      tracking.trackQuizSpell(currentWord.word, true, input)
      this._doMarkMastered()
      this._goNextWord()
    } else {
      // 填错了，清空重填
      tracking.trackQuizSpell(currentWord.word, false, input)
      this._saveError(currentWord, 'spell', input, expected)
      this.setData({
        spellWrong: true,
        spellHint: `正确答案：${currentWord.word}`,
        spellInput: ''
      })
      setTimeout(() => {
        this.setData({ spellWrong: false, spellHint: '' })
      }, 2000)
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
      this._saveProgress()
    } catch (err) {
      console.error('标记失败', err)
    }
  },

  // ===== 底部按钮 =====
  onPrevWord() {
    const { currentIndex } = this.data
    if (currentIndex <= 0) {
      wx.showToast({ title: '已是第一个', icon: 'none' })
      return
    }
    audio.stop()
    this.setData({
      currentIndex: currentIndex - 1,
      step: 1,
      choiceSelected: -1,
      choiceCorrect: false,
      choiceWrong: false,
      spellInput: '',
      spellWrong: false
    })
    this._playCurrentWordAudio()
  },

  onNextWord() {
    // 如果还在步骤1或2，提示需要完成测试
    const { step } = this.data
    if (step < 3) {
      wx.showToast({ title: '请完成当前单词测试', icon: 'none' })
      return
    }
    this._goNextWord()
  },

  _goNextWord() {
    const { currentIndex, words } = this.data
    if (currentIndex >= words.length - 1) {
      // 最后一个词完成
      this.onAllDone()
    } else {
      audio.stop()
      this.setData({
        currentIndex: currentIndex + 1,
        step: 1,
        choiceSelected: -1,
        choiceCorrect: false,
        choiceWrong: false,
        spellInput: '',
        spellWrong: false,
        spellHint: ''
      })
      this._playCurrentWordAudio()
    }
  },

  // 标记为"不熟"，加入重点记忆
  onMarkUnfamiliar() {
    const { words, currentIndex, focusWords } = this.data
    const currentWord = words[currentIndex]
    if (!currentWord) return

    // 检查是否已在重点记忆中
    const exists = focusWords.includes(currentWord.word)
    if (exists) {
      wx.showToast({ title: '已在重点记忆中', icon: 'none' })
      return
    }

    const newFocusWords = [...focusWords, currentWord.word]
    wx.setStorageSync('focus_words', newFocusWords)
    this.setData({ focusWords: newFocusWords })
    wx.showToast({ title: '已加入重点记忆', icon: 'success' })
  },

  // 完成学习
  async onAllDone() {
    this.setData({ allDone: true })
    const duration = Math.round((Date.now() - this._learnStartTime) / 1000)

    const { progress, unit, todayLearned } = this.data
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

    tracking.trackLearnComplete(unit, todayLearned.length, duration)

    if (todayLearned.length > 0) {
      this.setData({ showCelebration: true })
    } else {
      this._showCompletionModal()
    }
  },

  onCelebrationComplete() {
    this.setData({ showCelebration: false })
    this._showCompletionModal()
  },

  _showCompletionModal() {
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