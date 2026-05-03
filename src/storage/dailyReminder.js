const KEY_PREFIX = 'dailyReminder_'

export function loadDailyReminder(dateKey) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + dateKey)
    if (!raw) return { message: '', time: '' }
    const parsed = JSON.parse(raw)
    return { message: parsed.message || '', time: parsed.time || '' }
  } catch {
    return { message: '', time: '' }
  }
}

export function saveDailyReminder(dateKey, message, time) {
  try {
    if (message.trim()) {
      localStorage.setItem(KEY_PREFIX + dateKey, JSON.stringify({
        message: message.trim(),
        time: time || '',
      }))
    } else {
      localStorage.removeItem(KEY_PREFIX + dateKey)
    }
  } catch {
    // ignore
  }
}
