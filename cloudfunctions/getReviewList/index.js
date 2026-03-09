const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  
  // 验证用户身份
  if (!OPENID) {
    return { words: [], reviewItems: [], count: 0, error: '未授权访问' }
  }
  
  const level = event.level || 'CET4'
  const today = new Date().toISOString().split('T')[0]

  // 获取用户进度
  const progressRes = await db.collection('user_progress')
    .where({ _openid: OPENID, level })
    .get()

  if (progressRes.data.length === 0) {
    return { words: [], reviewItems: [], count: 0 }
  }

  const progress = progressRes.data[0]
  const reviewItems = (progress.review_queue || []).filter(
    item => item.next_review && item.next_review <= today
  )

  if (reviewItems.length === 0) {
    return { words: [], reviewItems: [], count: 0 }
  }

  // 获取待复习单词的完整数据
  const wordNames = reviewItems.map(item => item.word)
  // 云数据库 in 查询最多支持一次查 20 条，需分批
  const batchSize = 20
  let allWords = []
  for (let i = 0; i < wordNames.length; i += batchSize) {
    const batch = wordNames.slice(i, i + batchSize)
    const res = await db.collection('words')
      .where({ word: _.in(batch), level })
      .get()
    allWords = allWords.concat(res.data)
  }

  return {
    words: allWords,
    reviewItems,
    count: reviewItems.length,
    progressId: progress._id
  }
}
