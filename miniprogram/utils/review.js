/**
 * 复习周期计算工具
 * 基于 2025-2026 认知科学研究：间隔重复 + 主动回忆 + 分组轮替
 */
const constants = require('./constants')

// 分组名称
const GROUPS = ['A', 'B', 'C']

/**
 * 获取今日日期字符串
 */
function getToday() {
  return new Date().toISOString().split('T')[0]
}

/**
 * 获取今日所属分组
 * 基于天数轮替：第1天=A, 第2天=B, 第3天=C, 第4天=A...
 */
function getTodayGroup() {
  const today = new Date()
  const dayOfYear = getDayOfYear(today)
  return GROUPS[(dayOfYear - 1) % constants.GROUP_COUNT]
}

/**
 * 获取日期是一年中的第几天
 */
function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date - start
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

/**
 * 从复习队列中筛选今日待复习的单词
 * 新逻辑：只复习今日分组的单词
 */
function getTodayReviewWords(reviewQueue) {
  const today = getToday()
  const todayGroup = getTodayGroup()

  return (reviewQueue || []).filter(item => {
    // 检查是否到期
    if (!item.next_review || item.next_review > today) return false
    // 检查是否属于今日分组
    if (item.group && item.group !== todayGroup) return false
    return true
  })
}

/**
 * 为单词分配分组
 * 基于学习顺序轮替分配 A/B/C
 */
function assignGroup(wordIndex) {
  return GROUPS[wordIndex % constants.GROUP_COUNT]
}

/**
 * 计算复习日期
 * 基于分组和当前日期计算复习日期
 */
function calculateReviewDates(group) {
  const today = new Date()
  const dayOfYear = getDayOfYear(today)
  const groupIndex = GROUPS.indexOf(group)

  // 基于分组计算复习偏移
  // A组: +1, +3, +7 天
  // B组: +2, +4, +8 天
  // C组: +3, +5, +9 天
  const offsets = constants.REVIEW_INTERVALS.map((interval, i) => {
    return interval + groupIndex
  })

  return offsets.map(offset => {
    const date = new Date(today)
    date.setDate(date.getDate() + offset)
    return date.toISOString().split('T')[0]
  })
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

/**
 * 获取今日预期复习量
 */
function getTodayExpectedReviewCount(reviewQueue) {
  const todayGroup = getTodayGroup()
  return (reviewQueue || []).filter(item => item.group === todayGroup).length
}

module.exports = {
  INTERVALS: constants.REVIEW_INTERVALS,
  GROUPS,
  getToday,
  getTodayGroup,
  getTodayReviewWords,
  assignGroup,
  calculateReviewDates,
  calcStreak,
  calcUnit,
  getUnitRange,
  isTodayComplete,
  getTodayExpectedReviewCount
}
