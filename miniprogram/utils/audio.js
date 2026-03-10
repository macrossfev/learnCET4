/**
 * 音频播放管理模块
 * 支持本地缓存，减少流量消耗
 */
const config = require('../config')
const constants = require('./constants')

let innerAudioCtx = null
let currentPlaylist = []
let currentIndex = 0
let isPlaying = false
let onSequenceComplete = null
let onItemPlay = null
let playSession = 0
let audioRetryCount = 0

// 缓存配置
const CACHE_PREFIX = 'audio_cache_'
const CACHE_INDEX_KEY = 'audio_cache_index'
const MAX_CACHE_SIZE = 100 * 1024 * 1024 // 100MB
const CACHE_EXPIRE_DAYS = 30

/**
 * 获取缓存索引
 */
function getCacheIndex() {
  try {
    return wx.getStorageSync(CACHE_INDEX_KEY) || {}
  } catch (e) {
    return {}
  }
}

/**
 * 保存缓存索引
 */
function saveCacheIndex(index) {
  try {
    wx.setStorageSync(CACHE_INDEX_KEY, index)
  } catch (e) {
    console.error('保存缓存索引失败', e)
  }
}

/**
 * 生成缓存 key
 */
function getCacheKey(fileID) {
  // 使用 fileID 的 hash 作为 key
  const hash = hashCode(fileID)
  return CACHE_PREFIX + hash
}

/**
 * 简单 hash 函数
 */
function hashCode(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

/**
 * 获取缓存文件路径
 * @param {string} fileID - 云存储文件 ID
 * @returns {string|null} 缓存路径或 null
 */
function getCachedAudio(fileID) {
  if (!fileID) return null

  const cacheKey = getCacheKey(fileID)
  const index = getCacheIndex()
  const cachedInfo = index[cacheKey]

  if (!cachedInfo) return null

  // 检查过期
  const expireTime = cachedInfo.timestamp + CACHE_EXPIRE_DAYS * 24 * 60 * 60 * 1000
  if (Date.now() > expireTime) {
    // 过期，删除缓存
    removeCachedAudio(fileID)
    return null
  }

  // 检查文件是否存在
  try {
    const fs = wx.getFileSystemManager()
    fs.accessSync(cachedInfo.path)
    return cachedInfo.path
  } catch (e) {
    // 文件不存在，删除索引
    delete index[cacheKey]
    saveCacheIndex(index)
    return null
  }
}

/**
 * 缓存音频文件
 * @param {string} fileID - 云存储文件 ID
 * @param {string} tempFilePath - 临时文件路径
 */
async function cacheAudio(fileID, tempFilePath) {
  if (!fileID || !tempFilePath) return null

  try {
    const cacheKey = getCacheKey(fileID)
    const fs = wx.getFileSystemManager()

    // 获取文件大小
    const stats = fs.statSync(tempFilePath)
    const fileSize = stats.size

    // 检查缓存空间
    await checkAndCleanCache(fileSize)

    // 生成永久存储路径
    const cachePath = `${wx.env.USER_DATA_PATH}/audio_cache/${cacheKey}.mp3`

    // 确保目录存在
    try {
      fs.mkdirSync(`${wx.env.USER_DATA_PATH}/audio_cache`, true)
    } catch (e) {
      // 目录已存在
    }

    // 复制文件到缓存目录
    fs.copyFileSync(tempFilePath, cachePath)

    // 更新索引
    const index = getCacheIndex()
    index[cacheKey] = {
      fileID,
      path: cachePath,
      size: fileSize,
      timestamp: Date.now()
    }
    saveCacheIndex(index)

    return cachePath
  } catch (e) {
    console.error('缓存音频失败', e)
    return null
  }
}

/**
 * 删除缓存
 */
function removeCachedAudio(fileID) {
  if (!fileID) return

  const cacheKey = getCacheKey(fileID)
  const index = getCacheIndex()
  const cachedInfo = index[cacheKey]

  if (cachedInfo) {
    try {
      const fs = wx.getFileSystemManager()
      fs.unlinkSync(cachedInfo.path)
    } catch (e) {
      // 文件可能已不存在
    }
    delete index[cacheKey]
    saveCacheIndex(index)
  }
}

/**
 * 检查并清理缓存
 */
async function checkAndCleanCache(needSize) {
  const index = getCacheIndex()
  let totalSize = 0

  // 计算当前缓存大小
  Object.values(index).forEach(item => {
    totalSize += item.size || 0
  })

  // 如果空间足够，直接返回
  if (totalSize + needSize <= MAX_CACHE_SIZE) {
    return true
  }

  // 按 LRU 策略清理
  const entries = Object.entries(index)
    .sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0))

  for (const [key, info] of entries) {
    if (totalSize + needSize <= MAX_CACHE_SIZE) break

    try {
      const fs = wx.getFileSystemManager()
      fs.unlinkSync(info.path)
      totalSize -= info.size || 0
      delete index[key]
    } catch (e) {
      // 忽略删除错误
    }
  }

  saveCacheIndex(index)
  return true
}

/**
 * 获取缓存统计
 */
function getCacheStats() {
  const index = getCacheIndex()
  let totalSize = 0
  let count = 0

  Object.values(index).forEach(item => {
    totalSize += item.size || 0
    count++
  })

  return {
    count,
    totalSize,
    maxSize: MAX_CACHE_SIZE,
    usedPercent: Math.round(totalSize / MAX_CACHE_SIZE * 100)
  }
}

/**
 * 清除所有缓存
 */
function clearAllCache() {
  const index = getCacheIndex()
  const fs = wx.getFileSystemManager()

  Object.values(index).forEach(info => {
    try {
      fs.unlinkSync(info.path)
    } catch (e) {
      // 忽略
    }
  })

  try {
    fs.rmdirSync(`${wx.env.USER_DATA_PATH}/audio_cache`, true)
  } catch (e) {
    // 忽略
  }

  wx.removeStorageSync(CACHE_INDEX_KEY)
}

/**
 * 创建音频上下文
 */
function createCtx() {
  if (innerAudioCtx) {
    innerAudioCtx.offEnded()
    innerAudioCtx.offError()
    innerAudioCtx.destroy()
    innerAudioCtx = null
  }
  
  innerAudioCtx = wx.createInnerAudioContext()
  innerAudioCtx.autoplay = false
  const session = playSession
  
  innerAudioCtx.onEnded(() => {
    if (session !== playSession) return
    audioRetryCount = 0
    currentIndex++
    playNext()
  })
  
  innerAudioCtx.onError((err) => {
    if (session !== playSession) return
    
    // 重试机制
    if (audioRetryCount < constants.AUDIO_MAX_RETRY) {
      audioRetryCount++
      console.log(`音频播放失败，重试 ${audioRetryCount}/${constants.AUDIO_MAX_RETRY}`)
      setTimeout(() => {
        innerAudioCtx.play()
      }, 500 * audioRetryCount)
      return
    }
    
    // 超过重试次数，跳过
    console.error('音频播放失败', err)
    audioRetryCount = 0
    currentIndex++
    playNext()
  })
  
  return innerAudioCtx
}

/**
 * 播放下一首
 */
async function playNext() {
  if (currentIndex >= currentPlaylist.length) {
    isPlaying = false
    if (onSequenceComplete) onSequenceComplete()
    return
  }

  const ctx = innerAudioCtx
  if (!ctx) return

  const item = currentPlaylist[currentIndex]
  if (onItemPlay) onItemPlay(currentIndex, item)

  ctx.playbackRate = getApp().globalData.settings.playSpeed || 1.0

  // 尝试从缓存获取
  let playUrl = item.url
  const cachedPath = getCachedAudio(item.url)

  if (cachedPath) {
    // 使用缓存
    playUrl = cachedPath
  } else if (item.url && item.url.startsWith('cloud://')) {
    // 下载并缓存
    try {
      const res = await wx.cloud.downloadFile({ fileID: item.url })
      const cachePath = await cacheAudio(item.url, res.tempFilePath)
      if (cachePath) {
        playUrl = cachePath
      } else {
        playUrl = res.tempFilePath
      }
    } catch (e) {
      console.error('下载音频失败', e)
      // 使用原始 URL
    }
  }

  // 显式设置 src 并播放，避免重复播放
  ctx.src = playUrl
  ctx.play()
}

/**
 * 播放单词的完整音频序列
 * @param {Object} audioObj - 音频对象 { word, meaning, phrase, phrase_meaning, example, example_meaning }
 * @param {Object} callbacks - 回调函数 { onComplete, onItemPlay }
 */
function playWordSequence(audioObj, callbacks = {}) {
  stop()
  onSequenceComplete = callbacks.onComplete || null
  onItemPlay = callbacks.onItemPlay || null
  audioRetryCount = 0

  currentPlaylist = [
    { url: audioObj.word, key: 'word' },
    { url: audioObj.meaning, key: 'meaning' },
    { url: audioObj.phrase, key: 'phrase' },
    { url: audioObj.phrase_meaning, key: 'phrase_meaning' },
    { url: audioObj.example, key: 'example' },
    { url: audioObj.example_meaning, key: 'example_meaning' }
  ].filter(item => item.url)

  currentIndex = 0
  isPlaying = true
  createCtx()
  playNext()
}

/**
 * 播放单个音频
 * @param {string} url - 音频 URL
 * @param {Function} callback - 播放完成回调
 */
function playSingle(url, callback) {
  stop()
  onSequenceComplete = callback || null
  onItemPlay = null
  audioRetryCount = 0
  
  currentPlaylist = [{ url, key: 'single' }]
  currentIndex = 0
  isPlaying = true
  createCtx()
  playNext()
}

/**
 * 停止播放
 */
function stop() {
  playSession++
  isPlaying = false
  currentIndex = 0
  currentPlaylist = []
  onSequenceComplete = null
  onItemPlay = null
  audioRetryCount = 0
  
  if (innerAudioCtx) {
    innerAudioCtx.stop()
  }
}

/**
 * 暂停播放
 */
function pause() {
  if (innerAudioCtx && isPlaying) {
    innerAudioCtx.pause()
    isPlaying = false
  }
}

/**
 * 恢复播放
 */
function resume() {
  if (innerAudioCtx && !isPlaying && currentPlaylist.length > 0) {
    innerAudioCtx.play()
    isPlaying = true
  }
}

/**
 * 获取播放状态
 */
function getIsPlaying() {
  return isPlaying
}

/**
 * 销毁音频上下文
 */
function destroy() {
  stop()
  if (innerAudioCtx) {
    innerAudioCtx.offEnded()
    innerAudioCtx.offError()
    innerAudioCtx.destroy()
    innerAudioCtx = null
  }
}

/**
 * 预加载单元音频
 * @param {Array} words - 单词列表
 * @returns {Promise<Array>} 预加载结果
 */
async function preloadUnitAudio(words) {
  const tasks = []
  for (const word of words) {
    if (!word.audio) continue
    const urls = Object.values(word.audio)
    for (const url of urls) {
      if (url && url.startsWith('cloud://')) {
        tasks.push(
          wx.cloud.downloadFile({ fileID: url })
            .then(res => ({ fileID: url, tempFilePath: res.tempFilePath }))
            .catch(() => null)
        )
      }
    }
  }
  const results = await Promise.all(tasks)
  return results.filter(Boolean)
}

/**
 * 预加载单个音频文件
 * @param {string} fileID - 云存储文件 ID
 * @returns {Promise<Object>} 预加载结果
 */
async function preloadAudio(fileID) {
  if (!fileID || !fileID.startsWith('cloud://')) return null
  try {
    const res = await wx.cloud.downloadFile({ fileID })
    return { fileID, tempFilePath: res.tempFilePath }
  } catch (err) {
    console.error('预加载音频失败', err)
    return null
  }
}

/**
 * 批量预加载音频（带进度回调）
 * @param {Array} fileIDs - 文件 ID 列表
 * @param {Function} onProgress - 进度回调 (current, total)
 * @returns {Promise<Array>} 预加载结果
 */
async function batchPreloadAudio(fileIDs, onProgress) {
  const results = []
  const total = fileIDs.length
  for (let i = 0; i < total; i++) {
    const result = await preloadAudio(fileIDs[i])
    results.push(result)
    if (onProgress) onProgress(i + 1, total)
  }
  return results.filter(Boolean)
}

/**
 * 清理音频缓存（保留最近的 N 个单元）
 * @param {number} keepCount - 保留数量
 */
function clearAudioCache(keepCount = 5) {
  const storageInfo = wx.getStorageInfoSync()
  const keys = storageInfo.keys || []
  const audioKeys = keys.filter(key => key.startsWith('audio_cache_'))
  if (audioKeys.length > keepCount) {
    const toRemove = audioKeys.slice(0, audioKeys.length - keepCount)
    toRemove.forEach(key => wx.removeStorageSync(key))
  }
}

module.exports = {
  playWordSequence,
  playSingle,
  stop,
  pause,
  resume,
  getIsPlaying,
  destroy,
  preloadUnitAudio,
  preloadAudio,
  batchPreloadAudio,
  clearAudioCache,
  // 新增缓存相关
  getCachedAudio,
  cacheAudio,
  getCacheStats,
  clearAllCache
}
