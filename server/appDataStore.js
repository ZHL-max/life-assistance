import fs from 'node:fs/promises'
import path from 'node:path'

function safeUserId(userId) {
  return String(userId ?? 'guest').replace(/[^\w.-]/g, '_')
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createAppDataStore({ dataDir }) {
  const usersDir = path.join(dataDir, 'users')

  function userDir(userId) {
    return path.join(usersDir, safeUserId(userId))
  }

  async function readJson(userId, fileName, fallback) {
    try {
      const raw = await fs.readFile(path.join(userDir(userId), fileName), 'utf8')
      return JSON.parse(raw)
    } catch {
      return fallback
    }
  }

  async function writeJson(userId, fileName, value) {
    await fs.mkdir(userDir(userId), { recursive: true })
    await fs.writeFile(path.join(userDir(userId), fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    return value
  }

  return {
    getTasks(userId) {
      return readJson(userId, 'tasks.json', [])
    },

    saveTasks(userId, tasks) {
      return writeJson(userId, 'tasks.json', Array.isArray(tasks) ? tasks : [])
    },

    getSchedule(userId) {
      return readJson(userId, 'schedule.json', [])
    },

    async saveSchedule(userId, events, options = {}) {
      const current = await this.getSchedule(userId)
      const nextEvents = Array.isArray(events) ? events : []
      const base = options.replaceRangeStart && options.replaceRangeEnd
        ? current.filter(event => (
            event.eventDate < options.replaceRangeStart || event.eventDate > options.replaceRangeEnd
          ))
        : current
      const stampedEvents = nextEvents.map(event => ({
        id: event.id ?? createId(),
        createdAt: event.createdAt ?? Date.now(),
        ...event,
      }))
      return writeJson(userId, 'schedule.json', [...base, ...stampedEvents])
    },

    async deleteScheduleEvent(userId, eventId) {
      const current = await this.getSchedule(userId)
      const next = current.filter(event => event.id !== eventId)
      return writeJson(userId, 'schedule.json', next)
    },

    getLongTasks(userId) {
      return readJson(userId, 'long-tasks.json', [])
    },

    async createLongTask(userId, task) {
      const current = await this.getLongTasks(userId)
      const nextTask = {
        id: createId(),
        title: task.title,
        category: task.category || 'competition',
        dueDate: task.dueDate || null,
        notes: task.notes || '',
        status: 'active',
        files: [],
        createdAt: Date.now(),
      }
      await writeJson(userId, 'long-tasks.json', [nextTask, ...current])
      return nextTask
    },

    async updateLongTask(userId, taskId, updates) {
      const current = await this.getLongTasks(userId)
      let saved = null
      const next = current.map(task => {
        if (task.id !== taskId) return task
        saved = {
          ...task,
          ...updates,
          id: task.id,
          files: task.files ?? [],
          updatedAt: Date.now(),
        }
        return saved
      })
      await writeJson(userId, 'long-tasks.json', next)
      if (!saved) throw new Error('长期任务不存在。')
      return saved
    },

    async deleteLongTask(userId, taskId) {
      const current = await this.getLongTasks(userId)
      const next = current.filter(task => task.id !== taskId)
      return writeJson(userId, 'long-tasks.json', next)
    },

    async addLongTaskFile(userId, taskId, file) {
      const current = await this.getLongTasks(userId)
      let savedFile = null
      const next = current.map(task => {
        if (task.id !== taskId) return task
        savedFile = {
          id: createId(),
          taskId,
          fileName: file.fileName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          dataUrl: file.dataUrl,
          createdAt: Date.now(),
        }
        return {
          ...task,
          files: [savedFile, ...(task.files ?? [])],
        }
      })
      await writeJson(userId, 'long-tasks.json', next)
      if (!savedFile) throw new Error('长期任务不存在。')
      return savedFile
    },

    async deleteLongTaskFile(userId, taskId, fileId) {
      const current = await this.getLongTasks(userId)
      const next = current.map(task => (
        task.id === taskId
          ? { ...task, files: (task.files ?? []).filter(file => file.id !== fileId) }
          : task
      ))
      return writeJson(userId, 'long-tasks.json', next)
    },

    getReminders(userId) {
      return readJson(userId, 'reminders.json', {})
    },

    saveReminders(userId, reminders) {
      return writeJson(userId, 'reminders.json', reminders && typeof reminders === 'object' ? reminders : {})
    },

    getPushSubscriptions(userId) {
      return readJson(userId, 'push-subscriptions.json', [])
    },

    savePushSubscriptions(userId, subs) {
      return writeJson(userId, 'push-subscriptions.json', Array.isArray(subs) ? subs : [])
    },

    async listUsers() {
      try {
        const entries = await fs.readdir(usersDir, { withFileTypes: true })
        return entries.filter(e => e.isDirectory()).map(e => e.name)
      } catch {
        return []
      }
    },

    getProfile(userId) {
      return readJson(userId, 'profile.json', { nickname: '', theme: 'light' })
    },

    saveProfile(userId, profile) {
      return writeJson(userId, 'profile.json', {
        nickname: profile?.nickname || '',
        theme: profile?.theme || 'light',
      })
    },
  }
}
