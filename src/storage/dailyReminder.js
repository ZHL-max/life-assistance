const KEY_PREFIX = 'dailyReminder_'

export function loadDailyReminder(dateKey) {
  try {
    return localStorage.getItem(KEY_PREFIX + dateKey) || ''
  } catch {
    return ''
  }
}

export function saveDailyReminder(dateKey, message) {
  try {
    if (message.trim()) {
      localStorage.setItem(KEY_PREFIX + dateKey, message.trim())
    } else {
      localStorage.removeItem(KEY_PREFIX + dateKey)
    }
  } catch {
    // ignore
  }
}
