const audio = require('../../utils/audio')

Component({
  options: {
    multipleSlots: true
  },
  properties: {
    word: { type: Object, value: {} },
    autoShowDetail: { type: Boolean, value: true }
  },

  data: {
    showDetail: true,
    isPlaying: false,
    playingLabel: '播放'
  },

  observers: {
    'word': function (word) {
      if (word && word.word) {
        this.setData({ showDetail: this.properties.autoShowDetail })
      }
    }
  },

  lifetimes: {
    detached() {
      audio.stop()
    }
  },

  methods: {
    toggleDetail() {
      this.setData({ showDetail: !this.data.showDetail })
    },

    onPlayTap() {
      if (audio.getIsPlaying()) {
        audio.stop()
        this.setData({ isPlaying: false, playingLabel: '播放' })
        return
      }
      this.playSequence()
    },

    playSequence() {
      const w = this.properties.word
      if (!w || !w.audio) return

      const labels = {
        word: '单词',
        meaning: '释义',
        phrase: '词组',
        phrase_meaning: '词组释义',
        example: '例句',
        example_meaning: '例句释义'
      }

      this.setData({ isPlaying: true })

      audio.playWordSequence(w.audio, {
        onItemPlay: (index, item) => {
          this.setData({ playingLabel: labels[item.key] || '播放中' })
        },
        onComplete: () => {
          this.setData({ isPlaying: false, playingLabel: '播放' })
          this.triggerEvent('sequenceComplete')
        }
      })
    }
  }
})
