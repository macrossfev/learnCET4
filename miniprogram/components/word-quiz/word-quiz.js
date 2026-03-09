/**
 * 单词测验卡片组件（学习和复习通用）
 * 功能：回想模式 + 三级掌握程度 + 测试
 */
const audio = require('../../utils/audio')

Component({
  options: {
    multipleSlots: true
  },
  
  properties: {
    word: { type: Object, value: {} },
    mode: { type: String, value: 'learn' }, // learn | review
    showAnswer: { type: Boolean, value: false },
    masteryLevel: { type: Number, value: 0 }
  },

  data: {
    localShowAnswer: false,
    localMasteryLevel: 0
  },

  lifetimes: {
    detached() {
      audio.stop()
    }
  },

  observers: {
    'word': function(word) {
      if (word && word.word) {
        this.setData({
          localShowAnswer: this.properties.showAnswer,
          localMasteryLevel: this.properties.masteryLevel
        })
      }
    }
  },

  methods: {
    // 显示释义
    onShowAnswer() {
      this.setData({ localShowAnswer: true })
      this.triggerEvent('showAnswer')
    },

    // 选择掌握程度
    onMasterySelect(e) {
      const { level } = e.currentTarget.dataset
      this.setData({ localMasteryLevel: level })
      this.triggerEvent('masterySelect', { level })
    },

    // 播放发音
    onPlayWord() {
      const w = this.properties.word
      if (w && w.audio && w.audio.word) {
        audio.playSingle(w.audio.word)
      }
    },

    // 重置
    onReset() {
      this.setData({
        localShowAnswer: false,
        localMasteryLevel: 0
      })
      this.triggerEvent('reset')
    }
  }
})
