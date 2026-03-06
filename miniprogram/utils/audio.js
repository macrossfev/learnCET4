let innerAudioCtx = null
let currentPlaylist = []
let currentIndex = 0
let isPlaying = false
let onSequenceComplete = null
let onItemPlay = null
let playSession = 0

function createCtx() {
  if (innerAudioCtx) {
    innerAudioCtx.offEnded()
    innerAudioCtx.offError()
    innerAudioCtx.destroy()
    innerAudioCtx = null
  }
  innerAudioCtx = wx.createInnerAudioContext()
  innerAudioCtx.autoplay = true
  const session = playSession
  innerAudioCtx.onEnded(() => {
    if (session !== playSession) return
    currentIndex++
    playNext()
  })
  innerAudioCtx.onError((err) => {
    if (session !== playSession) return
    console.error('音频播放失败', err)
    currentIndex++
    playNext()
  })
  return innerAudioCtx
}

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
  ctx.src = item.url
}

// 播放单词的完整音频序列
// audioObj: { word, meaning, phrase, phrase_meaning, example, example_meaning }
function playWordSequence(audioObj, callbacks = {}) {
  stop()
  onSequenceComplete = callbacks.onComplete || null
  onItemPlay = callbacks.onItemPlay || null

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

// 播放单个音频
function playSingle(url, callback) {
  stop()
  onSequenceComplete = callback || null
  onItemPlay = null
  currentPlaylist = [{ url, key: 'single' }]
  currentIndex = 0
  isPlaying = true
  createCtx()
  playNext()
}

function stop() {
  playSession++
  isPlaying = false
  currentIndex = 0
  currentPlaylist = []
  onSequenceComplete = null
  onItemPlay = null
  if (innerAudioCtx) {
    innerAudioCtx.stop()
  }
}

function pause() {
  if (innerAudioCtx && isPlaying) {
    innerAudioCtx.pause()
    isPlaying = false
  }
}

function resume() {
  if (innerAudioCtx && !isPlaying && currentPlaylist.length > 0) {
    innerAudioCtx.play()
    isPlaying = true
  }
}

function getIsPlaying() {
  return isPlaying
}

function destroy() {
  stop()
  if (innerAudioCtx) {
    innerAudioCtx.offEnded()
    innerAudioCtx.offError()
    innerAudioCtx.destroy()
    innerAudioCtx = null
  }
}

// 预加载单元音频（后台下载缓存）
async function preloadUnitAudio(words) {
  const tasks = []
  for (const word of words) {
    if (!word.audio) continue
    const urls = Object.values(word.audio)
    for (const url of urls) {
      if (url && url.startsWith('cloud://')) {
        tasks.push(
          wx.cloud.downloadFile({ fileID: url })
            .then(res => {
              return { fileID: url, tempFilePath: res.tempFilePath }
            })
            .catch(() => null)
        )
      }
    }
  }
  const results = await Promise.all(tasks)
  return results.filter(Boolean)
}

module.exports = {
  playWordSequence,
  playSingle,
  stop,
  pause,
  resume,
  getIsPlaying,
  destroy,
  preloadUnitAudio
}
