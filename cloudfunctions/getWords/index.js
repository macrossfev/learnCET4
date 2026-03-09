const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  
  // 验证用户身份
  if (!OPENID) {
    return { words: [], error: '未授权访问' }
  }
  
  const { level, skip, limit, startRank, endRank } = event
  const _ = db.command

  let query = db.collection('words').where({ level: level || 'CET4' })

  if (startRank && endRank) {
    query = db.collection('words').where({
      level: level || 'CET4',
      freq_rank: _.gte(startRank).and(_.lte(endRank))
    })
  }

  query = query.orderBy('freq_rank', 'asc')

  if (startRank && endRank) {
    const res = await query.limit(endRank - startRank + 1).get()
    return { words: res.data, total: res.data.length }
  }

  const countRes = await query.count()
  const res = await query.skip(skip || 0).limit(limit || 20).get()
  return { words: res.data, total: countRes.total }
}
