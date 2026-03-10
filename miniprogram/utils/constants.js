/**
 * 常量配置文件
 * 基于 2025-2026 认知科学研究优化
 */
module.exports = {
  // 词汇总量
  TOTAL_WORDS: 1000,

  // 默认每日学习量（基于最新研究：25词/天）
  DEFAULT_DAILY_COUNT: 25,

  // 复习间隔（天）- 基于最新研究简化为3个关键节点
  REVIEW_INTERVALS: [1, 3, 7],

  // 分组数量（A/B/C 三组轮替）
  GROUP_COUNT: 3,

  // 每组词数
  WORDS_PER_GROUP: 25,

  // 每个单词的音频文件数量
  AUDIO_FILES_PER_WORD: 6,

  // 音频重试次数
  AUDIO_MAX_RETRY: 3,

  // 学习进度自动保存间隔（毫秒）
  AUTO_SAVE_INTERVAL: 30000,

  // 中断恢复有效时间（毫秒）
  RECOVER_TIMEOUT: 30 * 60 * 1000,

  // 云数据库批次大小
  DB_BATCH_SIZE: 20,

  // 测试干扰项数量
  CHOICE_DISTRACTOR_COUNT: 3,

  // 成就徽章配置
  BADGES: {
    streak3: { icon: '🔥', name: '坚持 3 天', threshold: 3, type: 'streak' },
    streak7: { icon: '⭐', name: '坚持 7 天', threshold: 7, type: 'streak' },
    streak30: { icon: '👑', name: '坚持 30 天', threshold: 30, type: 'streak' },
    beginner: { icon: '📚', name: '初学者', threshold: 1, type: 'learning' },
    hundred: { icon: '⚔️', name: '百词斩', threshold: 100, type: 'learning' },
    fiveHundred: { icon: '🏆', name: '五百词', threshold: 500, type: 'learning' },
    thousand: { icon: '💎', name: '千词达人', threshold: 1000, type: 'learning' },
    perfect: { icon: '🎯', name: '测试王者', threshold: 100, type: 'accuracy', condition: 'accuracy === 100 && totalLearned >= 10' }
  }
}
