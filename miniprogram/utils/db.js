const db = wx.cloud.database()
const _ = db.command

const collections = {
  WORDS: 'words',
  USER_PROGRESS: 'user_progress'
}

// 分页获取单词列表
async function getWords(level, skip, limit) {
  const res = await wx.cloud.callFunction({
    name: 'getWords',
    data: { level, skip, limit }
  })
  return res.result
}

// 按freq_rank范围获取单词（用于学习单元）
async function getWordsByRange(level, startRank, endRank) {
  const res = await wx.cloud.callFunction({
    name: 'getWords',
    data: { level, startRank, endRank }
  })
  return res.result
}

// 获取用户学习进度
async function getUserProgress(level) {
  const res = await db.collection(collections.USER_PROGRESS)
    .where({ level })
    .get()
  return res.data.length > 0 ? res.data[0] : null
}

// 初始化用户进度记录
async function initUserProgress(level) {
  const now = new Date().toISOString().split('T')[0]
  const data = {
    level,
    learned_words: [],
    daily_count: getApp().globalData.settings.dailyCount,
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

// 更新学习进度
async function updateProgress(progressId, data) {
  return await wx.cloud.callFunction({
    name: 'updateProgress',
    data: { progressId, ...data }
  })
}

// 标记单词已学习
async function markWordLearned(progressId, word, learnedWords, reviewQueue) {
  const today = new Date().toISOString().split('T')[0]
  const intervals = [1, 3, 7, 14, 30]
  const reviewDates = intervals.map(d => {
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

  const newLearnedWords = [...learnedWords, word]
  const newReviewQueue = [...reviewQueue, newReviewItem]

  return await updateProgress(progressId, {
    learned_words: newLearnedWords,
    review_queue: newReviewQueue,
    total_learned: newLearnedWords.length
  })
}

// 获取今日待复习单词
async function getReviewList() {
  const res = await wx.cloud.callFunction({
    name: 'getReviewList',
    data: {}
  })
  return res.result
}

// 更新复习结果
async function updateReviewResult(progressId, word, remembered, reviewQueue) {
  const today = new Date().toISOString().split('T')[0]
  const newQueue = reviewQueue.map(item => {
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
      const intervals = [1, 3, 7, 14, 30]
      const reviewDates = intervals.map(d => {
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

// 更新测试成绩
async function updateTestScore(progressId, correct, total) {
  return await updateProgress(progressId, {
    test_correct_inc: correct,
    test_total_inc: total
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
