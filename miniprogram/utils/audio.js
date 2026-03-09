/**
 * 音频播放管理模块
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
function playNext() {
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
  
  // 显式设置 src 并播放，避免重复播放
  ctx.src = item.url
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
  clearAudioCache
}
