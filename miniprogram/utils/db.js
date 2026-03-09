/**
 * 数据库操作模块
 */
const config = require('../config')
const constants = require('./constants')

const db = wx.cloud.database()
const _ = db.command

const collections = {
  WORDS: 'words',
  USER_PROGRESS: 'user_progress'
}

/**
 * 分页获取单词列表
 */
async function getWords(level, skip, limit) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'getWords',
      data: { level, skip, limit }
    })
    return res.result || { words: [], total: 0 }
  } catch (err) {
    console.error('获取单词失败', err)
    wx.showToast({ title: '获取单词失败', icon: 'none' })
    return { words: [], total: 0 }
  }
}

/**
 * 按 freq_rank 范围获取单词
 */
async function getWordsByRange(level, startRank, endRank) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'getWords',
      data: { level, startRank, endRank }
    })
    return res.result || { words: [], total: 0 }
  } catch (err) {
    console.error('获取单词失败', err)
    wx.showToast({ title: '获取单词失败', icon: 'none' })
    return { words: [], total: 0 }
  }
}

/**
 * 获取用户学习进度
 */
async function getUserProgress(level) {
  try {
    const res = await db.collection(collections.USER_PROGRESS)
      .where({ level })
      .get()
    return res.data.length > 0 ? res.data[0] : null
  } catch (err) {
    console.error('获取进度失败', err)
    return null
  }
}

/**
 * 初始化用户学习进度记录
 */
async function initUserProgress(level) {
  const now = new Date().toISOString().split('T')[0]
  const data = {
    level,
    learned_words: [],
    daily_count: getApp().globalData.settings.dailyCount || constants.DEFAULT_DAILY_COUNT,
    current_unit: 1,
    review_queue: [],
    stats: {
      total_days: 0,
      streak_days: 0,
      total_learned: 0,
      last_learn_date: '',
      test_correct: 0,
      test_total: 0
    }
  }
  const res = await db.collection(collections.USER_PROGRESS).add({ data })
  data._id = res._id
  return data
}

/**
 * 更新学习进度
 */
async function updateProgress(progressId, data) {
  try {
    return await wx.cloud.callFunction({
      name: 'updateProgress',
      data: { progressId, ...data }
    })
  } catch (err) {
    console.error('更新进度失败', err)
    wx.showToast({ title: '更新进度失败', icon: 'none' })
    return { success: false }
  }
}

/**
 * 标记单词已学习
 */
async function markWordLearned(progressId, word, learnedWords, reviewQueue) {
  const today = new Date().toISOString().split('T')[0]
  const reviewDates = constants.REVIEW_INTERVALS.map(d => {
    const date = new Date()
    date.setDate(date.getDate() + d)
    return date.toISOString().split('T')[0]
  })

  const newReviewItem = {
    word,
    last_learned: today,
    review_dates: reviewDates,
    next_review: reviewDates[0],
    stage: 0
  }

  const newLearnedWords = [...(learnedWords || []), word]
  const newReviewQueue = [...(reviewQueue || []), newReviewItem]

  return await updateProgress(progressId, {
    learned_words: newLearnedWords,
    review_queue: newReviewQueue,
    total_learned: newLearnedWords.length
  })
}

/**
 * 获取今日待复习单词
 */
async function getReviewList() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'getReviewList',
      data: {}
    })
    return res.result || { words: [], reviewItems: [], count: 0 }
  } catch (err) {
    console.error('获取复习列表失败', err)
    return { words: [], reviewItems: [], count: 0 }
  }
}

/**
 * 更新复习结果
 */
async function updateReviewResult(progressId, word, remembered, reviewQueue) {
  const today = new Date().toISOString().split('T')[0]
  const newQueue = (reviewQueue || []).map(item => {
    if (item.word !== word) return item
    if (remembered) {
      const nextStage = item.stage + 1
      if (nextStage >= item.review_dates.length) {
        return { ...item, stage: nextStage, next_review: null }
      }
      return {
        ...item,
        stage: nextStage,
        next_review: item.review_dates[nextStage]
      }
    } else {
      const reviewDates = constants.REVIEW_INTERVALS.map(d => {
        const date = new Date()
        date.setDate(date.getDate() + d)
        return date.toISOString().split('T')[0]
      })
      return {
        ...item,
        last_learned: today,
        review_dates: reviewDates,
        next_review: reviewDates[0],
        stage: 0
      }
    }
  })

  return await updateProgress(progressId, {
    review_queue: newQueue
  })
}

/**
 * 更新测试成绩
 */
async function updateTestScore(progressId, correct, total) {
  const safeCorrect = Math.max(0, correct || 0)
  const safeTotal = Math.max(0, total || 0)
  
  if (safeTotal === 0) return { success: true }
  
  return await updateProgress(progressId, {
    test_correct_inc: safeCorrect,
    test_total_inc: safeTotal
  })
}

module.exports = {
  db,
  _,
  collections,
  getWords,
  getWordsByRange,
  getUserProgress,
  initUserProgress,
  updateProgress,
  markWordLearned,
  getReviewList,
  updateReviewResult,
  updateTestScore
}
