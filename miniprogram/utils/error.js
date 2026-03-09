/**
 * 统一错误处理工具
 */
const config = require('../config')

/**
 * 处理错误并显示提示
 * @param {Object} err - 错误对象
 * @param {string} defaultMessage - 默认错误信息
 * @param {Object} options - 配置选项
 */
function handleError(err, defaultMessage = '操作失败', options = {}) {
  const {
    showToast = true,
    duration = 2000,
    icon = 'none'
  } = options
  
  // 记录错误日志
  if (config.debug || config.logLevel === 'error') {
    console.error('[Error]', defaultMessage, err)
  }
  
  // 显示错误提示
  if (showToast) {
    const message = err?.errMsg || err?.message || defaultMessage
    wx.showToast({
      title: message,
      icon,
      duration
    })
  }
  
  return {
    success: false,
    error: err,
    message: err?.errMsg || err?.message || defaultMessage
  }
}

/**
 * 安全执行异步函数
 * @param {Function} fn - 异步函数
 * @param {string} errorMessage - 错误信息
 * @returns {Promise<[any, Error]>} [result, error]
 */
async function safeAsync(fn, errorMessage = '操作失败') {
  try {
    const result = await fn()
    return [result, null]
  } catch (err) {
    handleError(err, errorMessage, { showToast: false })
    return [null, err]
  }
}

/**
 * 显示加载提示
 * @param {string} title - 提示文字
 */
function showLoading(title = '加载中...') {
  wx.showLoading({
    title,
    mask: true
  })
}

/**
 * 隐藏加载提示
 */
function hideLoading() {
  wx.hideLoading()
}

module.exports = {
  handleError,
  safeAsync,
  showLoading,
  hideLoading
}
