/**
 * 学习日历组件
 * 显示用户打卡记录，可视化学习坚持痕迹
 */
Component({
  properties: {
    // 打卡记录对象 { "2026-03-01": { learned: 5, reviewed: 3 }, ... }
    checkInRecords: {
      type: Object,
      value: {}
    },
    // 当前显示的年份
    year: {
      type: Number,
      value: 0
    },
    // 当前显示的月份
    month: {
      type: Number,
      value: 0
    }
  },

  data: {
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: [],
    currentYear: 0,
    currentMonth: 0,
    today: ''
  },

  lifetimes: {
    attached() {
      const now = new Date()
      const year = this.data.year || now.getFullYear()
      const month = this.data.month || (now.getMonth() + 1)
      const today = now.toISOString().split('T')[0]

      this.setData({
        currentYear: year,
        currentMonth: month,
        today
      })
      this.generateCalendar(year, month)
    }
  },

  observers: {
    'checkInRecords': function(records) {
      this.generateCalendar(this.data.currentYear, this.data.currentMonth)
    }
  },

  methods: {
    /**
     * 生成日历数据
     */
    generateCalendar(year, month) {
      const days = []
      const firstDay = new Date(year, month - 1, 1)
      const lastDay = new Date(year, month, 0)
      const startWeekDay = firstDay.getDay()
      const totalDays = lastDay.getDate()

      // 填充上月空白
      for (let i = 0; i < startWeekDay; i++) {
        days.push({ day: '', empty: true })
      }

      // 填充当月日期
      for (let d = 1; d <= totalDays; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const record = this.data.checkInRecords[dateStr] || {}

        days.push({
          day: d,
          dateStr,
          isToday: dateStr === this.data.today,
          checked: !!(record.learned || record.reviewed),
          learned: record.learned || 0,
          reviewed: record.reviewed || 0,
          status: this._getStatus(record)
        })
      }

      this.setData({ calendarDays: days })
    },

    _getStatus(record) {
      if (record.learned && record.reviewed) return 'both'
      if (record.learned) return 'learned'
      if (record.reviewed) return 'reviewed'
      return 'none'
    },

    /**
     * 上个月
     */
    prevMonth() {
      let { currentYear, currentMonth } = this.data
      if (currentMonth === 1) {
        currentYear--
        currentMonth = 12
      } else {
        currentMonth--
      }
      this.setData({ currentYear, currentMonth })
      this.generateCalendar(currentYear, currentMonth)
      this.triggerEvent('monthChange', { year: currentYear, month: currentMonth })
    },

    /**
     * 下个月
     */
    nextMonth() {
      let { currentYear, currentMonth } = this.data
      if (currentMonth === 12) {
        currentYear++
        currentMonth = 1
      } else {
        currentMonth++
      }
      this.setData({ currentYear, currentMonth })
      this.generateCalendar(currentYear, currentMonth)
      this.triggerEvent('monthChange', { year: currentYear, month: currentMonth })
    },

    /**
     * 点击日期
     */
    onTapDay(e) {
      const { datestr, checked, learned, reviewed } = e.currentTarget.dataset
      if (!datestr) return

      this.triggerEvent('dayTap', {
        date: datestr,
        checked,
        learned,
        reviewed
      })
    }
  }
})