/**
 * 复习模式选择页面
 */
const db = require('../../utils/db')

Page({
  data: {
    reviewCount: 0,
    modes: [
      {
        id: 'quick',
        icon: '📖',
        title: '快速复习',
        desc: '只看单词和释义，快速过',
        time: '5-10 分钟',
        color: 'blue'
      },
      {
        id: 'normal',
        icon: '📝',
        title: '标准复习',
        desc: '回想 + 三级掌握程度，深度巩固',
        time: '15-20 分钟',
        color: 'green',
        recommended: true
      },
      {
        id: 'test',
        icon: '🎯',
        title: '测试复习',
        desc: '每个单词都测试，强化记忆',
        time: '20-30 分钟',
        color: 'orange'
      },
      {
        id: 'focus',
        icon: '⚡',
        title: '重点复习',
        desc: '只复习高频遗忘词',
        time: '5-15 分钟',
        color: 'red'
      }
    ]
  },

  onLoad() {
    this.loadReviewCount()
  },

  async loadReviewCount() {
    try {
      const result = await db.getReviewList()
      this.setData({
        reviewCount: result.count || 0
      })
    } catch (err) {
      console.error('加载复习数量失败', err)
    }
  },

  onSelectMode(e) {
    const { id } = e.currentTarget.dataset
    
    // 保存模式选择
    wx.setStorageSync('reviewMode', id)
    
    // 跳转到复习页面
    wx.navigateTo({
      url: `/pages/review/review?mode=${id}`,
      fail: (err) => {
        console.error('跳转失败', err)
        wx.showToast({ title: '请先学习单词', icon: 'none' })
      }
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '一起来复习四级词汇',
      path: '/pages/index/index'
    }
  }
})
