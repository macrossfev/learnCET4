const INTERVALS = [1, 3, 7, 14, 30]

// 获取今日日期字符串
function getToday() {
  return new Date().toISOString().split('T')[0]
}

// 计算复习日期列表
function calcReviewDates(fromDate) {
  const base = fromDate ? new Date(fromDate) : new Date()
  return INTERVALS.map(d => {
    const date = new Date(base)
    date.setDate(date.getDate() + d)
    return date.toISOString().split('T')[0]
  })
}

// 从复习队列中筛选今日待复习的单词
function getTodayReviewWords(reviewQueue) {
  const today = getToday()
  return reviewQueue.filter(item =>
    item.next_review && item.next_review <= today
  )
}

// 计算连续打卡天数
function calcStreak(lastLearnDate, currentStreak) {
  const today = getToday()
  if (lastLearnDate === today) return currentStreak

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  if (lastLearnDate === yesterdayStr) return currentStreak + 1
  return 1
}

// 计算学习单元（每日学习量为一个单元）
function calcUnit(learnedCount, dailyCount) {
  return Math.floor(learnedCount / dailyCount) + 1
}

// 获取当前单元的词汇范围（freq_rank）
function getUnitRange(unit, dailyCount) {
  const startRank = (unit - 1) * dailyCount + 1
  const endRank = unit * dailyCount
  return { startRank, endRank }
}

// 判断今日学习是否完成
function isTodayComplete(lastLearnDate, todayLearnedCount, dailyCount) {
  const today = getToday()
  if (lastLearnDate !== today) return false
  return todayLearnedCount >= dailyCount
}

module.exports = {
  INTERVALS,
  getToday,
  calcReviewDates,
  getTodayReviewWords,
  calcStreak,
  calcUnit,
  getUnitRange,
  isTodayComplete
}
