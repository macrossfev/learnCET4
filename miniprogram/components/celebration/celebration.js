/**
 * 庆祝动画组件
 * 学习完成时显示烟花/彩带效果
 */
Component({
  properties: {
    // 是否显示
    show: {
      type: Boolean,
      value: false
    },
    // 动画类型：firework(烟花) | confetti(彩带) | both(两者)
    type: {
      type: String,
      value: 'both'
    },
    // 持续时间（毫秒）
    duration: {
      type: Number,
      value: 3000
    }
  },

  data: {
    particles: [],
    fireworks: [],
    visible: false
  },

  lifetimes: {
    attached() {
      this._particleId = 0
    }
  },

  observers: {
    'show': function(show) {
      if (show) {
        this.startAnimation()
      } else {
        this.stopAnimation()
      }
    }
  },

  methods: {
    startAnimation() {
      this.setData({ visible: true })

      // 生成粒子
      this._generateParticles()

      // 生成烟花
      if (this.data.type === 'firework' || this.data.type === 'both') {
        this._launchFireworks()
      }

      // 自动关闭
      setTimeout(() => {
        this.stopAnimation()
      }, this.data.duration)
    },

    stopAnimation() {
      this.setData({ visible: false, particles: [], fireworks: [] })
      if (this._timer) {
        clearInterval(this._timer)
        this._timer = null
      }
      this.triggerEvent('complete')
    },

    _generateParticles() {
      const particles = []
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']

      for (let i = 0; i < 50; i++) {
        particles.push({
          id: this._particleId++,
          x: Math.random() * 100,
          y: 100 + Math.random() * 20,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 6 + Math.random() * 8,
          delay: Math.random() * 0.5,
          duration: 1.5 + Math.random() * 1,
          rotate: Math.random() * 360
        })
      }

      this.setData({ particles })
    },

    _launchFireworks() {
      const fireworks = []
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFEAA7', '#DDA0DD']

      // 发射3-5组烟花
      const count = 3 + Math.floor(Math.random() * 3)
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const fw = {
            id: Date.now() + i,
            x: 15 + Math.random() * 70,
            y: 20 + Math.random() * 30,
            color: colors[Math.floor(Math.random() * colors.length)],
            particles: this._createFireworkParticles()
          }
          this.setData({
            fireworks: [...this.data.fireworks, fw]
          })

          // 1.5秒后移除这组烟花
          setTimeout(() => {
            const list = this.data.fireworks.filter(f => f.id !== fw.id)
            this.setData({ fireworks: list })
          }, 1500)
        }, i * 400)
      }
    },

    _createFireworkParticles() {
      const particles = []
      for (let i = 0; i < 12; i++) {
        particles.push({
          angle: (i / 12) * 360,
          distance: 30 + Math.random() * 20
        })
      }
      return particles
    },

    onTap() {
      this.stopAnimation()
    }
  }
})