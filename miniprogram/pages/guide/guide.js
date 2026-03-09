/**
 * 新手引导页面
 */
const config = require('../../config')

Page({
  data: {
    currentStep: 0,
    steps: [
      {
        icon: '📚',
        title: '四级必过',
        subtitle: '每天 20 词',
        desc: '30 天掌握四级核心词汇',
        dotIndex: 0
      },
      {
        icon: '📝',
        title: '学完即测',
        subtitle: '即时巩固',
        desc: '每个单词学习后自动进入测试，答对即掌握',
        dotIndex: 1
      },
      {
        icon: '🔄',
        title: '间隔复习',
        subtitle: '科学记忆',
        desc: '1 天→3 天→7 天→14 天→30 天，对抗遗忘曲线',
        dotIndex: 2
      },
      {
        icon: '👆',
        title: '点击播放',
        subtitle: '听音学词',
        desc: '点击喇叭图标播放发音，跟读加深记忆',
        dotIndex: 3,
        isDemo: true
      }
    ],
    // 实操演示数据
    demoWord: {
      word: 'abandon',
      phonetic: '/əˈbændən/',
      meaning: '放弃'
    }
  },

  onNext() {
    const { currentStep, steps } = this.data
    if (currentStep < steps.length - 1) {
      this.setData({ currentStep: currentStep + 1 })
    } else {
      this.completeGuide()
    }
  },

  onStart() {
    this.completeGuide()
  },

  completeGuide() {
    wx.setStorageSync('hasGuidance', true)
    wx.switchTab({
      url: '/pages/index/index',
      fail: (err) => {
        if (config.debug) console.error('switchTab fail:', err)
      }
    })
  },

  onSkip() {
    wx.setStorageSync('hasGuidance', true)
    wx.switchTab({
      url: '/pages/index/index',
      fail: (err) => {
        if (config.debug) console.error('switchTab fail:', err)
      }
    })
  },

  // 播放演示音频
  onPlayDemo() {
    wx.showToast({
      title: '🔊 播放发音',
      icon: 'none',
      duration: 1500
    })
  }
})
