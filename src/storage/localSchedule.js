const LOCAL_SCHEDULE_KEY = 'life-assistant-schedule-events-v1'

function getKey(userId) {
  return `${LOCAL_SCHEDULE_KEY}:${userId}`
}

export function loadLocalScheduleEvents(userId) {
  try {
    const raw = localStorage.getItem(getKey(userId))
    const events = raw ? JSON.parse(raw) : []
    return Array.isArray(events) ? events : []
  } catch {
    return []
  }
}

export function saveLocalScheduleEvents(userId, events) {
  try {
    localStorage.setItem(getKey(userId), JSON.stringify(events))
  } catch {
    // 本机缓存不可用时，只保留当前内存状态。
  }
}
