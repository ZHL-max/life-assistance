import { useState, useEffect, useCallback } from 'react'
import AuthGate from './components/AuthGate'
import AppTopBar from './components/AppTopBar'
import HomeHero from './components/HomeHero'
import ProgressBar from './components/ProgressBar'
import TaskInput from './components/TaskInput'
import TaskList from './components/TaskList'
import Dashboard from './components/Dashboard'
import LongTasks from './components/LongTasks'
import Calendar from './components/Calendar'
import Schedule from './components/Schedule'
import Vault from './components/Vault'
import Settings from './components/Settings'
import BottomNav from './components/BottomNav'
import { getLocalNickname, saveLocalNickname } from './storage/nickname'
import { setTheme } from './storage/theme'
import { fetchCloudProfile } from './storage/cloudProfile'
import { fetchLongTasks } from './storage/cloudLongTasks'
import { fetchScheduleEvents } from './storage/cloudSchedule'
import {
  ensureDailyOccurrences,
  getTodayKey,
  loadLocalTasks,
  saveLocalTasks,
  stopDailyRepeat,
} from './storage/tasks'
import { fetchCloudTasks, replaceCloudTasks } from './storage/cloudTasks'
import './App.css'

function TaskApp({ session, onSignOut }) {
  const userId = session.user.id
  const userEmail = session.user.email
  const userName = session.user.user_metadata?.name
    || session.user.user_metadata?.full_name
    || userEmail?.split('@')[0]
  const [nickname, setNickname] = useState(() => getLocalNickname(userId))
  const [allTasks, setAllTasks] = useState([])
  const [longTasks, setLongTasks] = useState([])
  const [filter, setFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('home')
  const [selectedDate, setSelectedDate] = useState(getTodayKey())
  const [showDailyComposer, setShowDailyComposer] = useState(false)
  const [scheduleEvents, setScheduleEvents] = useState([])
  const [storageReady, setStorageReady] = useState(false)

  useEffect(() => {
    let ignore = false

    async function hydrateTasks() {
      try {
        const cloudTasks = await fetchCloudTasks(userId)

        if (ignore) return

        setAllTasks(cloudTasks)
        saveLocalTasks(cloudTasks, userId)
      } catch (error) {
        console.error('Failed to fetch daily tasks:', error)
        if (ignore) return

        setAllTasks(loadLocalTasks(userId))
      } finally {
        if (!ignore) setStorageReady(true)
      }
    }

    hydrateTasks()

    return () => {
      ignore = true
    }
  }, [userId])

  useEffect(() => {
    let ignore = false

    async function loadCalendarExtras() {
      try {
        const events = await fetchScheduleEvents(userId)
        if (!ignore) setScheduleEvents(events)
      } catch {
        if (!ignore) setScheduleEvents([])
      }
    }

    loadCalendarExtras()

    return () => {
      ignore = true
    }
  }, [userId])

  // 从云端加载昵称和主题
  useEffect(() => {
    fetchCloudProfile(userId)
      .then(profile => {
        if (profile.nickname) {
          saveLocalNickname(userId, profile.nickname)
          setNickname(profile.nickname)
        }
        if (profile.theme) {
          setTheme(profile.theme)
        }
      })
      .catch(() => {})
  }, [userId])

  useEffect(() => {
    let ignore = false

    async function notifyLongTasks() {
      if (!('Notification' in window)) return

      try {
        const loaded = await fetchLongTasks(userId)
        if (ignore) return

        setLongTasks(loaded)

        const today = new Date(`${getTodayKey()}T00:00:00`)
        const urgentTasks = loaded.filter(task => {
          if (task.status === 'done' || !task.dueDate) return false
          const due = new Date(`${task.dueDate}T00:00:00`)
          const days = Math.round((due - today) / 86400000)
          return days <= 3
        })

        if (urgentTasks.length === 0) return

        const permission = Notification.permission === 'default'
          ? await Notification.requestPermission()
          : Notification.permission

        if (permission !== 'granted') return

        new Notification('长期任务提醒', {
          body: `${urgentTasks.length} 个长期任务临近或已超过 DDL。`,
          icon: '/pika-icon.svg',
        })
      } catch {
        if (!ignore) setLongTasks([])
      }
    }

    notifyLongTasks()

    return () => {
      ignore = true
    }
  }, [userId])

  useEffect(() => {
    if (!storageReady) return

    saveLocalTasks(allTasks, userId)
  }, [allTasks, storageReady, userId])

  const updateTasks = useCallback((updater) => {
    setAllTasks(prev => {
      const next = updater(prev)

      replaceCloudTasks(next, userId)
        .then(cloudTasks => {
          setAllTasks(current => (
            JSON.stringify(current) === JSON.stringify(next) ? cloudTasks : current
          ))
          saveLocalTasks(cloudTasks, userId)
        })
        .catch((error) => {
          console.error('Failed to save daily tasks:', error)
          saveLocalTasks(next, userId)
        })

      return next
    })
  }, [userId])

  useEffect(() => {
    if (!storageReady) return

    setAllTasks(prev => {
      const next = ensureDailyOccurrences(prev, [getTodayKey(), selectedDate])
      if (next === prev) return prev

      replaceCloudTasks(next, userId)
        .then(() => {})
        .catch((error) => {
          console.error('Failed to save generated daily tasks:', error)
        })

      return next
    })
  }, [selectedDate, storageReady, userId])

  const tasks = allTasks.filter(t => t.date === selectedDate)
  const addTask = useCallback((text, options = {}) => {
    if (!text.trim()) return
    const repeatId = options.repeatDaily ? crypto.randomUUID() : undefined

    updateTasks(prev => [...prev, {
      id: crypto.randomUUID(),
      text: text.trim(),
      done: false,
      date: selectedDate,
      createdAt: Date.now(),
      color: options.color || '',
      reminderTime: options.reminderTime || '',
      ...(options.repeatDaily ? {
        repeat: 'daily',
        repeatId,
        repeatStartedAt: selectedDate,
      } : {}),
    }])
  }, [selectedDate, updateTasks])

  const editTask = useCallback((id, text) => {
    const nextText = text.trim()
    if (!nextText) return

    updateTasks(prev => prev.map(t => (
      t.id === id ? { ...t, text: nextText, updatedAt: Date.now() } : t
    )))
  }, [updateTasks])

  const togglePinTask = useCallback((id) => {
    updateTasks(prev => prev.map(t => {
      if (t.id !== id) return t

      const nextPinned = !t.pinned
      return {
        ...t,
        pinned: nextPinned,
        pinnedAt: nextPinned ? Date.now() : null,
      }
    }))
  }, [updateTasks])

  const stopRepeatTask = useCallback((id) => {
    updateTasks(prev => stopDailyRepeat(prev, id))
  }, [updateTasks])

  const toggleTask = useCallback((id) => {
    updateTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }, [updateTasks])

  const deleteTask = useCallback((id) => {
    updateTasks(prev => prev.filter(t => t.id !== id))
  }, [updateTasks])

  const clearDone = useCallback(() => {
    updateTasks(prev => prev.filter(t => !(t.date === selectedDate && t.done)))
  }, [selectedDate, updateTasks])

  const handleDayClick = (dateKey) => {
    setSelectedDate(dateKey)
    setActiveTab('daily')
  }

  const total = tasks.length
  const doneCount = tasks.filter(t => t.done).length

  const filteredTasks = tasks.filter(t => {
    if (filter === 'active') return !t.done
    if (filter === 'done') return t.done
    return true
  })

  return (
    <div className="app-root">
      <div className="app-scroll-area">
        <AppTopBar
          activeTab={activeTab}
          onBack={() => setActiveTab('home')}
          onSettings={() => setActiveTab('settings')}
        />

        {activeTab === 'home' && (
          <HomeHero total={total} doneCount={doneCount} userName={nickname || userName} />
        )}

        <main className="app-main">
          {activeTab === 'home' && (
            <Dashboard
              userId={userId}
              tasks={allTasks}
              onNavigate={setActiveTab}
            />
          )}

          {/* Calendar View */}
          {activeTab === 'calendar' && (
            <Calendar
              selectedDate={selectedDate}
              allTasks={allTasks}
              longTasks={longTasks}
              scheduleEvents={scheduleEvents}
              onDayClick={handleDayClick}
            />
          )}

          {activeTab === 'long' && (
            <LongTasks userId={userId} />
          )}

          {activeTab === 'schedule' && (
            <Schedule userId={userId} />
          )}

          {activeTab === 'vault' && (
            <Vault userId={userId} />
          )}

          {activeTab === 'settings' && (
            <Settings
              userEmail={userEmail}
              userId={userId}
              onNicknameChange={setNickname}
              onSignOut={onSignOut}
            />
          )}

          {/* Daily Task View */}
          {activeTab === 'daily' && (
            <>
              <ProgressBar total={total} done={doneCount} />

              <div className="filter-bar">
                {['all', 'active', 'done'].map(f => (
                  <button
                    key={f}
                    className={`filter-chip ${filter === f ? 'active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? '全部' : f === 'active' ? '待完成' : '已完成'}
                  </button>
                ))}
                {doneCount > 0 && (
                  <button className="clear-chip" onClick={clearDone}>
                    <span className="material-symbols-outlined" style={{fontSize:'16px'}}>delete_sweep</span>
                    清除已完成
                  </button>
                )}
              </div>

              <TaskList
                tasks={filteredTasks}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onEdit={editTask}
                onPin={togglePinTask}
                onStopRepeat={stopRepeatTask}
              />

              {tasks.length === 0 && (
                <div className="empty-state">
                  <span className="material-symbols-outlined empty-icon-ms">bolt</span>
                  <p className="empty-title">{selectedDate === getTodayKey() ? '今天还没有任务' : '这天没有任务记录'}</p>
                  <p className="empty-sub">添加第一项任务，开始今天的安排。</p>
                </div>
              )}
              {tasks.length > 0 && filteredTasks.length === 0 && (
                <div className="empty-state">
                  <span className="material-symbols-outlined empty-icon-ms">
                    {filter === 'active' ? 'celebration' : 'inbox'}
                  </span>
                  <p className="empty-title">
                    {filter === 'active' ? '所有任务已完成！' : '还没有已完成任务'}
                  </p>
                </div>
              )}
              <button className="fab-add" onClick={() => setShowDailyComposer(true)} aria-label="添加今日任务">
                +
              </button>
              {showDailyComposer && (
                <div className="composer-backdrop" onClick={() => setShowDailyComposer(false)}>
                  <div className="composer-sheet" onClick={event => event.stopPropagation()}>
                    <h3>添加今日任务</h3>
                    <TaskInput
                      onAdd={(text, options) => {
                        addTask(text, options)
                        setShowDailyComposer(false)
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default function App() {
  return (
    <AuthGate>
      {({ session, onSignOut }) => (
        <TaskApp session={session} onSignOut={onSignOut} />
      )}
    </AuthGate>
  )
}
