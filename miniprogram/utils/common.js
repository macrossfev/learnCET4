/**
 * 通用工具函数
 */
const config = require('../config')

/**
 * 数组随机打乱（Fisher-Yates 洗牌算法）
 * @param {Array} arr - 原数组
 * @returns {Array} 打乱后的新数组
 */
function shuffle(arr) {
  if (!arr || !Array.isArray(arr)) return []
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * 从数组中随机获取指定数量的元素
 * @param {Array} arr - 原数组
 * @param {number} count - 获取数量
 * @returns {Array} 随机元素数组
 */
function getRandomItems(arr, count) {
  if (!arr || !Array.isArray(arr)) return []
  const shuffled = shuffle(arr)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

/**
 * 获取今日日期字符串
 * @returns {string} 格式：YYYY-MM-DD
 */
function getToday() {
  return new Date().toISOString().split('T')[0]
}

/**
 * 计算复习日期列表
 * @param {string} fromDate - 起始日期
 * @param {Array<number>} intervals - 间隔天数数组
 * @returns {Array<string>} 复习日期列表
 */
function calcReviewDates(fromDate, intervals = [1, 3, 7, 14, 30]) {
  const base = fromDate ? new Date(fromDate) : new Date()
  return intervals.map(d => {
    const date = new Date(base)
    date.setDate(date.getDate() + d)
    return date.toISOString().split('T')[0]
  })
}

/**
 * 安全计算百分比
 * @param {number} part - 部分值
 * @param {number} total - 总值
 * @param {number} decimals - 小数位数
 * @returns {number} 百分比
 */
function safePercent(part, total, decimals = 0) {
  if (!total || total <= 0) return 0
  const result = ((part || 0) / total) * 100
  return decimals > 0 ? result.toFixed(decimals) : Math.round(result)
}

/**
 * 日志工具
 * @param {string} level - 日志级别
 * @param {string} message - 日志内容
 * @param {any} data - 附加数据
 */
function log(level, message, data) {
  const levels = ['debug', 'info', 'warn', 'error']
  const currentLevelIndex = levels.indexOf(config.logLevel)
  const messageLevelIndex = levels.indexOf(level)
  
  if (messageLevelIndex < currentLevelIndex) return
  
  if (config.debug || level === 'error') {
    const prefix = `[${level.toUpperCase()}]`
    if (level === 'error') {
      console.error(prefix, message, data || '')
    } else if (level === 'warn') {
      console.warn(prefix, message, data || '')
    } else {
      console.log(prefix, message, data || '')
    }
  }
}

/**
 * 防抖函数
 * @param {Function} fn - 需要防抖的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(fn, delay = 300) {
  let timer = null
  return function(...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

/**
 * 节流函数
 * @param {Function} fn - 需要节流的函数
 * @param {number} interval - 间隔时间（毫秒）
 * @returns {Function} 节流后的函数
 */
function throttle(fn, interval = 300) {
  let lastTime = 0
  return function(...args) {
    const now = Date.now()
    if (now - lastTime >= interval) {
      lastTime = now
      fn.apply(this, args)
    }
  }
}

module.exports = {
  shuffle,
  getRandomItems,
  getToday,
  calcReviewDates,
  safePercent,
  log,
  debounce,
  throttle
}
