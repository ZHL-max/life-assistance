import { getTodayKey } from '../utils/date'

export { getTodayKey }

const STORAGE_KEY = 'life-assistant-tasks-v2'

function getStorageKey(scope) {
  return scope ? `${STORAGE_KEY}:${scope}` : STORAGE_KEY
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function clearRepeatFields(task) {
  const nextTask = { ...task }

  delete nextTask.repeat
  delete nextTask.repeatId
  delete nextTask.repeatStartedAt
  delete nextTask.generatedFrom

  return nextTask
}

export function loadLocalTasks(scope) {
  try {
    const raw = localStorage.getItem(getStorageKey(scope))
    const tasks = raw ? JSON.parse(raw) : []

    return Array.isArray(tasks) ? tasks : []
  } catch {
    return []
  }
}

export function saveLocalTasks(tasks, scope) {
  try {
    localStorage.setItem(getStorageKey(scope), JSON.stringify(tasks))
  } catch {
    // 浏览器禁用本地存储时，继续使用内存状态。
  }
}

export function ensureDailyOccurrences(tasks, dates) {
  const targetDates = [...new Set(dates)].filter(Boolean).sort()
  if (targetDates.length === 0) return tasks

  const addedTasks = []

  for (const date of targetDates) {
    const currentTasks = [...tasks, ...addedTasks]
    const dailyTasks = currentTasks.filter(task => task.repeat === 'daily' && task.repeatId)
    const repeatIds = [...new Set(dailyTasks.map(task => task.repeatId))]

    for (const repeatId of repeatIds) {
      const series = dailyTasks
        .filter(task => task.repeatId === repeatId)
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

      const firstTask = series[0]
      const startedAt = firstTask?.repeatStartedAt ?? firstTask?.date

      if (!startedAt || startedAt > date) continue
      if (series.some(task => task.date === date)) continue

      const source = [...series]
        .filter(task => task.date <= date)
        .sort((a, b) => {
          const byDate = (b.date ?? '').localeCompare(a.date ?? '')
          if (byDate !== 0) return byDate

          return (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)
        })[0] ?? firstTask

      if (!source) continue

      addedTasks.push({
        id: createId(),
        text: source.text,
        done: false,
        date,
        createdAt: Date.now(),
        repeat: 'daily',
        repeatId,
        repeatStartedAt: startedAt,
        generatedFrom: source.id,
        pinned: Boolean(source.pinned),
        pinnedAt: source.pinned ? Date.now() : null,
        color: source.color || '',
      })
    }
  }

  return addedTasks.length > 0 ? [...tasks, ...addedTasks] : tasks
}

export function stopDailyRepeat(tasks, taskId) {
  const task = tasks.find(item => item.id === taskId)
  if (!task?.repeatId) return tasks

  return tasks.map(item => (
    item.repeatId === task.repeatId ? clearRepeatFields(item) : item
  ))
}
