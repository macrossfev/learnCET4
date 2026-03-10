/**
 * 复习页面 - 与学习流程一致
 * 三步流程：单词展示 → 选择题 → 填词
 */
const db = require('../../utils/db')
const review = require('../../utils/review')
const constants = require('../../utils/constants')
const audio = require('../../utils/audio')
const tracking = require('../../utils/tracking')

Page({
  data: {
    words: [],
    reviewItems: [],
    currentIndex: 0,
    progressId: '',
    completed: false,
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
    // 复习信息提示
    reviewGroup: '',
    reviewDay: 0,
    reviewDate: ''
  },

  _touchStartX: 0,
  _touchStartY: 0,

  onLoad() {
    this.loadReviewList()
  },

  onUnload() {
    audio.stop()
  },

  async loadReviewList() {
    wx.showLoading({ title: '加载中...' })
    try {
      const level = 'CET4'
      const progress = await db.getUserProgress(level)

      if (!progress) {
        wx.hideLoading()
        wx.showToast({ title: '暂无复习内容', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1500)
        return
      }

      // 获取今日待复习单词
      const todayReviewWords = review.getTodayReviewWords(progress.review_queue || [])

      if (todayReviewWords.length === 0) {
        wx.hideLoading()
        wx.showToast({ title: '今日复习已完成', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 1500)
        return
      }

      // 获取单词详情
      const result = await db.getReviewList()
      const words = result.words || []

      // 获取复习信息
      const todayGroup = review.getTodayGroup()
      const reviewDate = new Date().toLocaleDateString('zh-CN', {
        month: 'long',
        day: 'numeric'
      })

      this.setData({
        words,
        reviewItems: progress.review_queue || [],
        progressId: progress._id,
        currentIndex: 0,
        completed: false,
        step: 1,
        reviewGroup: todayGroup,
        reviewDay: Math.floor((new Date().getDate() - 1) / 3) + 1,
        reviewDate
      })
      wx.hideLoading()

      // 播放当前单词音频
      this._playCurrentWordAudio()

      tracking.trackReviewStart(words.length)
    } catch (err) {
      console.error('加载复习列表失败', err)
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  _playCurrentWordAudio() {
    const { words, currentIndex, step } = this.data
    if (!words[currentIndex]) return

    const word = words[currentIndex]
    if (step === 1 && word.audio) {
      audio.playWordSequence(word.audio)
    }
  },

  // ===== 滑动处理 =====
  onTouchStart(e) {
    this._touchStartX = e.touches[0].clientX
    this._touchStartY = e.touches[0].clientY
  },

  onTouchEnd(e) {
    const deltaX = e.changedTouches[0].clientX - this._touchStartX
    const deltaY = e.changedTouches[0].clientY - this._touchStartY
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY)) return

    if (deltaX > 0) {
      this.nextStep()
    } else {
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
      if (step === 1) {
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
      tracking.trackQuizChoice(currentWord.word, true, option.meaning)
      setTimeout(() => {
        this.setData({ step: 3, spellInput: '', spellWrong: false })
      }, 800)
    } else {
      tracking.trackQuizChoice(currentWord.word, false, option.meaning)
      this._saveError(currentWord, 'choice', option.meaning, currentWord.meaning)
      setTimeout(() => {
        this.setData({ choiceSelected: -1, choiceWrong: false })
      }, 1500)
    }
  },

  // ===== 填词 =====
  onSpellInput(e) {
    this.setData({ spellInput: e.detail.value, spellWrong: false })
  },

  async onSpellSubmit() {
    const { words, currentIndex, spellInput, reviewItems, progressId } = this.data
    if (!spellInput.trim()) return

    const currentWord = words[currentIndex]
    const input = spellInput.trim().toLowerCase()
    const expected = currentWord.word.toLowerCase()
    const isCorrect = input === expected

    if (isCorrect) {
      tracking.trackQuizSpell(currentWord.word, true, input)
      tracking.trackReviewWord(currentWord.word, true)

      // 更新复习结果
      await this._updateReviewResult(currentWord.word, true)

      // 进入下一词
      this._goNextWord()
    } else {
      tracking.trackQuizSpell(currentWord.word, false, input)
      tracking.trackReviewWord(currentWord.word, false)
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

  async _updateReviewResult(word, remembered) {
    const { reviewItems, progressId } = this.data
    try {
      await db.updateReviewResult(progressId, word, remembered, reviewItems)
    } catch (err) {
      console.error('更新复习结果失败', err)
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
      this._completeReview()
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

  _completeReview() {
    this.setData({ completed: true })
    tracking.trackReviewComplete(this.data.words.length, this.data.words.length, 0)
  },

  goBack() {
    wx.navigateBack()
  }
})