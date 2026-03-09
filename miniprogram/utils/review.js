/**
 * 复习周期计算工具
 */
const constants = require('./constants')

/**
 * 获取今日日期字符串
 */
function getToday() {
  return new Date().toISOString().split('T')[0]
}

/**
 * 从复习队列中筛选今日待复习的单词
 */
function getTodayReviewWords(reviewQueue) {
  const today = getToday()
  return (reviewQueue || []).filter(item =>
    item.next_review && item.next_review <= today
  )
}

/**
 * 计算连续打卡天数
 */
function calcStreak(lastLearnDate, currentStreak) {
  const today = getToday()
  if (lastLearnDate === today) return currentStreak || 0

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  if (lastLearnDate === yesterdayStr) return (currentStreak || 0) + 1
  return 1
}

/**
 * 计算学习单元
 */
function calcUnit(learnedCount, dailyCount) {
  const count = dailyCount || constants.DEFAULT_DAILY_COUNT
  return Math.floor((learnedCount || 0) / count) + 1
}

/**
 * 获取当前单元的词汇范围
 */
function getUnitRange(unit, dailyCount) {
  const count = dailyCount || constants.DEFAULT_DAILY_COUNT
  const startRank = (unit - 1) * count + 1
  const endRank = unit * count
  return { startRank, endRank }
}

/**
 * 判断今日学习是否完成
 */
function isTodayComplete(lastLearnDate, todayLearnedCount, dailyCount) {
  const today = getToday()
  if (lastLearnDate !== today) return false
  const count = dailyCount || constants.DEFAULT_DAILY_COUNT
  return (todayLearnedCount || 0) >= count
}

module.exports = {
  INTERVALS: constants.REVIEW_INTERVALS,
  getToday,
  getTodayReviewWords,
  calcStreak,
  calcUnit,
  getUnitRange,
  isTodayComplete
}
