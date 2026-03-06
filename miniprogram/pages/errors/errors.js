Page({
  data: {
    errorDays: [],
    expandedDate: ''
  },

  onShow() {
    this.loadErrors()
  },

  loadErrors() {
    const errorBook = wx.getStorageSync('error_book') || {}
    const days = Object.keys(errorBook).sort().reverse().map(date => ({
      date,
      errors: errorBook[date],
      count: errorBook[date].length
    }))
    this.setData({ errorDays: days })
  },

  toggleDate(e) {
    const date = e.currentTarget.dataset.date
    this.setData({
      expandedDate: this.data.expandedDate === date ? '' : date
    })
  },

  clearAll() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有错题记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('error_book')
          this.setData({ errorDays: [] })
          wx.showToast({ title: '已清空', icon: 'success' })
        }
      }
    })
  }
})
