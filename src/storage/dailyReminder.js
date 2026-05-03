const KEY_PREFIX = 'dailyReminder_'

export function loadDailyReminders(dateKey) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + dateKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    // 兼容旧格式 {message, time}
    if (parsed.message) return [{ id: '1', message: parsed.message, time: parsed.time || '' }]
    return []
  } catch {
    return []
  }
}

export function saveDailyReminders(dateKey, reminders) {
  try {
    if (reminders.length > 0) {
      localStorage.setItem(KEY_PREFIX + dateKey, JSON.stringify(reminders))
    } else {
      localStorage.removeItem(KEY_PREFIX + dateKey)
    }
  } catch {
    // ignore
  }
}
