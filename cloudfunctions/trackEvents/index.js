const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { events } = event
  const wxContext = cloud.getWXContext()

  if (!events || !Array.isArray(events) || events.length === 0) {
    return { success: false, message: 'No events to track' }
  }

  try {
    const collection = db.collection('tracking_events')
    const openid = wxContext.OPENID

    // 批量插入事件
    const records = events.map(e => ({
      ...e,
      openid,
      serverTime: Date.now()
    }))

    // 分批插入，每批 20 条
    const batchSize = 20
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      await collection.add({ data: batch })
    }

    return { success: true, count: records.length }
  } catch (err) {
    console.error('Track events error:', err)
    return { success: false, error: err.message }
  }
}