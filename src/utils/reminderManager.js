const timers = new Map()

function clearAll() {
  for (const timer of timers.values()) {
    clearTimeout(timer)
  }
  timers.clear()
}

export function scheduleReminders(tasks) {
  clearAll()

  if (!('Notification' in window)) return

  const now = Date.now()

  for (const task of tasks) {
    if (!task.reminderTime || task.done) continue

    const [hh, mm] = task.reminderTime.split(':').map(Number)
    const target = new Date()
    target.setHours(hh, mm, 0, 0)

    const delay = target.getTime() - now

    if (delay <= 0) continue

    const timer = setTimeout(async () => {
      timers.delete(task.id)

      try {
        const permission = Notification.permission === 'default'
          ? await Notification.requestPermission()
          : Notification.permission

        if (permission !== 'granted') return

        new Notification('任务提醒', {
          body: task.text,
          icon: '/pika-icon.svg',
          tag: `reminder-${task.id}`,
        })
      } catch {
        // 通知失败不影响主流程。
      }
    }, delay)

    timers.set(task.id, timer)
  }
}
