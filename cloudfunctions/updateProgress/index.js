const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  
  // 验证用户身份
  if (!OPENID) {
    return { success: false, error: '未授权访问' }
  }
  
  const { progressId, learned_words, review_queue, total_learned, test_correct_inc, test_total_inc, daily_count, current_unit, stats } = event

  // 验证数据所有权
  if (progressId) {
    const progressRes = await db.collection('user_progress')
      .where({ _id: progressId, _openid: OPENID })
      .get()
    
    if (progressRes.data.length === 0) {
      return { success: false, error: '无权访问此数据' }
    }
  }

  const updateData = {}

  if (learned_words !== undefined) updateData.learned_words = learned_words
  if (review_queue !== undefined) updateData.review_queue = review_queue
  if (total_learned !== undefined) updateData['stats.total_learned'] = total_learned
  if (daily_count !== undefined) updateData.daily_count = daily_count
  if (current_unit !== undefined) updateData.current_unit = current_unit
  if (stats !== undefined) Object.assign(updateData, flattenStats(stats))

  if (test_correct_inc) updateData['stats.test_correct'] = _.inc(test_correct_inc)
  if (test_total_inc) updateData['stats.test_total'] = _.inc(test_total_inc)

  if (Object.keys(updateData).length === 0) {
    return { success: true, message: 'nothing to update' }
  }

  await db.collection('user_progress').doc(progressId).update({ data: updateData })
  return { success: true }
}

function flattenStats(stats) {
  const result = {}
  for (const key of Object.keys(stats)) {
    result[`stats.${key}`] = stats[key]
  }
  return result
}
