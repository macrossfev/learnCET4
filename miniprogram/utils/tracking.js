/**
 * 数据埋点模块
 * 用于收集用户行为数据，支持产品迭代优化
 */

const config = require('../config')

// 埋点事件定义
const EVENTS = {
  // 页面访问
  PAGE_VIEW: 'page_view',

  // 学习相关
  LEARN_START: 'learn_start',           // 开始学习
  LEARN_WORD: 'learn_word',             // 学习单词
  LEARN_COMPLETE: 'learn_complete',     // 完成学习
  LEARN_INTERRUPT: 'learn_interrupt',   // 学习中断

  // 测试相关
  QUIZ_START: 'quiz_start',             // 开始测试
  QUIZ_CHOICE: 'quiz_choice',           // 选择题答题
  QUIZ_SPELL: 'quiz_spell',             // 默写答题
  QUIZ_PASS: 'quiz_pass',               // 测试通过
  QUIZ_FAIL: 'quiz_fail',               // 测试失败
  QUIZ_SKIP: 'quiz_skip',               // 跳过测试

  // 复习相关
  REVIEW_START: 'review_start',         // 开始复习
  REVIEW_WORD: 'review_word',           // 复习单词
  REVIEW_COMPLETE: 'review_complete',   // 完成复习

  // 用户行为
  AUDIO_PLAY: 'audio_play',             // 播放音频
  AUDIO_ERROR: 'audio_error',           // 音频错误
  SETTING_CHANGE: 'setting_change',     // 设置变更
  SHARE_TRIGGER: 'share_trigger',       // 触发分享

  // 错误
  ERROR: 'error'                        // 错误日志
}

// 埋点数据存储 key
const TRACKING_STORAGE_KEY = 'tracking_events'
const MAX_LOCAL_EVENTS = 100  // 本地最多存储事件数
const UPLOAD_THRESHOLD = 20   // 达到阈值上传

/**
 * 记录事件
 * @param {string} eventName - 事件名称
 * @param {Object} params - 事件参数
 */
function track(eventName, params = {}) {
  const event = {
    event: eventName,
    params,
    timestamp: Date.now(),
    date: new Date().toISOString().split('T')[0],
    sessionId: getSessionId()
  }

  // 添加到本地队列
  addToQueue(event)

  // 开发环境打印日志
  if (config.debug) {
    console.log('[Track]', eventName, params)
  }
}

/**
 * 获取会话 ID
 */
let _sessionId = null
function getSessionId() {
  if (!_sessionId) {
    _sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6)
  }
  return _sessionId
}

/**
 * 添加事件到队列
 */
function addToQueue(event) {
  try {
    let events = wx.getStorageSync(TRACKING_STORAGE_KEY) || []
    events.push(event)

    // 限制本地存储数量
    if (events.length > MAX_LOCAL_EVENTS) {
      events = events.slice(-MAX_LOCAL_EVENTS)
    }

    wx.setStorageSync(TRACKING_STORAGE_KEY, events)

    // 达到阈值尝试上传
    if (events.length >= UPLOAD_THRESHOLD) {
      uploadEvents()
    }
  } catch (e) {
    console.error('存储埋点事件失败', e)
  }
}

/**
 * 上传事件到服务器
 */
async function uploadEvents() {
  try {
    const events = wx.getStorageSync(TRACKING_STORAGE_KEY) || []
    if (events.length === 0) return

    // 调用云函数上传
    await wx.cloud.callFunction({
      name: 'trackEvents',
      data: { events }
    })

    // 清空本地队列
    wx.setStorageSync(TRACKING_STORAGE_KEY, [])
  } catch (e) {
    // 上传失败，保留本地数据下次重试
    console.error('上传埋点事件失败', e)
  }
}

/**
 * 页面访问埋点
 */
function trackPageView(pageName) {
  track(EVENTS.PAGE_VIEW, { page: pageName })
}

/**
 * 学习开始埋点
 */
function trackLearnStart(unit, wordCount) {
  track(EVENTS.LEARN_START, { unit, wordCount })
}

/**
 * 学习单词埋点
 */
function trackLearnWord(word, duration) {
  track(EVENTS.LEARN_WORD, { word, duration })
}

/**
 * 学习完成埋点
 */
function trackLearnComplete(unit, learnedCount, duration) {
  track(EVENTS.LEARN_COMPLETE, { unit, learnedCount, duration })
}

/**
 * 测试开始埋点
 */
function trackQuizStart(word) {
  track(EVENTS.QUIZ_START, { word })
}

/**
 * 选择题答题埋点
 */
function trackQuizChoice(word, correct, selectedOption) {
  track(correct ? EVENTS.QUIZ_PASS : EVENTS.QUIZ_FAIL, {
    word,
    type: 'choice',
    correct,
    selectedOption
  })
}

/**
 * 默写答题埋点
 */
function trackQuizSpell(word, correct, userInput) {
  track(correct ? EVENTS.QUIZ_PASS : EVENTS.QUIZ_FAIL, {
    word,
    type: 'spell',
    correct,
    userInput: correct ? null : userInput // 只记录错误输入
  })
}

/**
 * 跳过测试埋点
 */
function trackQuizSkip(word) {
  track(EVENTS.QUIZ_SKIP, { word })
}

/**
 * 复习开始埋点
 */
function trackReviewStart(count) {
  track(EVENTS.REVIEW_START, { count })
}

/**
 * 复习单词埋点
 */
function trackReviewWord(word, remembered) {
  track(EVENTS.REVIEW_WORD, { word, remembered })
}

/**
 * 复习完成埋点
 */
function trackReviewComplete(totalCount, rememberedCount, duration) {
  track(EVENTS.REVIEW_COMPLETE, { totalCount, rememberedCount, duration })
}

/**
 * 音频播放埋点
 */
function trackAudioPlay(word, audioType) {
  track(EVENTS.AUDIO_PLAY, { word, audioType })
}

/**
 * 音频错误埋点
 */
function trackAudioError(word, error) {
  track(EVENTS.AUDIO_ERROR, { word, error: error.message || error })
}

/**
 * 设置变更埋点
 */
function trackSettingChange(key, oldValue, newValue) {
  track(EVENTS.SETTING_CHANGE, { key, oldValue, newValue })
}

/**
 * 分享触发埋点
 */
function trackShareTrigger(type) {
  track(EVENTS.SHARE_TRIGGER, { type })
}

/**
 * 错误埋点
 */
function trackError(errorType, message, stack) {
  track(EVENTS.ERROR, { errorType, message, stack })
}

module.exports = {
  EVENTS,
  track,
  uploadEvents,
  // 便捷方法
  trackPageView,
  trackLearnStart,
  trackLearnWord,
  trackLearnComplete,
  trackQuizStart,
  trackQuizChoice,
  trackQuizSpell,
  trackQuizSkip,
  trackReviewStart,
  trackReviewWord,
  trackReviewComplete,
  trackAudioPlay,
  trackAudioError,
  trackSettingChange,
  trackShareTrigger,
  trackError
}