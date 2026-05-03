import { useEffect, useRef, useState } from 'react'
import { fetchLongTasks } from '../storage/cloudLongTasks'
import { loadDailyReminder, saveDailyReminder } from '../storage/dailyReminder'
import './Dashboard.css'

function getTodayKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

let reminderTimer = null

function scheduleReminderNotification(message, time) {
  if (reminderTimer) {
    clearTimeout(reminderTimer)
    reminderTimer = null
  }
  if (!message || !time || !('Notification' in window)) return

  const [hh, mm] = time.split(':').map(Number)
  const target = new Date()
  target.setHours(hh, mm, 0, 0)
  const delay = target.getTime() - Date.now()

  if (delay <= 0) return

  reminderTimer = setTimeout(async () => {
    reminderTimer = null
    try {
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission
      if (permission !== 'granted') return
      new Notification('今日提醒', {
        body: message,
        icon: '/pika-icon.svg',
        tag: 'daily-reminder',
      })
    } catch {
      // ignore
    }
  }, delay)
}

export default function Dashboard({ userId, tasks, onNavigate }) {
  const [longTasks, setLongTasks] = useState([])
  const [reminderMsg, setReminderMsg] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const [isEditingReminder, setIsEditingReminder] = useState(false)
  const [editText, setEditText] = useState('')
  const [editTime, setEditTime] = useState('')
  const timerRef = useRef(reminderTimer)

  const todayKey = getTodayKey()

  useEffect(() => {
    let ignore = false

    async function loadLongTasks() {
      try {
        const loaded = await fetchLongTasks(userId)
        if (!ignore) setLongTasks(loaded)
      } catch {
        if (!ignore) setLongTasks([])
      }
    }

    loadLongTasks()

    return () => {
      ignore = true
    }
  }, [userId])

  useEffect(() => {
    const { message, time } = loadDailyReminder(todayKey)
    setReminderMsg(message)
    setReminderTime(time)
    if (message && time) {
      scheduleReminderNotification(message, time)
    }
  }, [todayKey])

  useEffect(() => {
    return () => {
      if (reminderTimer) {
        clearTimeout(reminderTimer)
        reminderTimer = null
      }
    }
  }, [])

  const todayTasks = tasks.filter(task => task.date === todayKey)
  const todayPending = todayTasks.filter(task => !task.done).length
  const activeLongTasks = longTasks.filter(task => task.status !== 'done')

  const startEditReminder = () => {
    setEditText(reminderMsg)
    setEditTime(reminderTime)
    setIsEditingReminder(true)
  }

  const saveReminder = () => {
    const msg = editText.trim()
    const time = editTime
    saveDailyReminder(todayKey, msg, time)
    setReminderMsg(msg)
    setReminderTime(time)
    setIsEditingReminder(false)

    if (msg && time) {
      scheduleReminderNotification(msg, time)
    }
  }

  const cancelEdit = () => {
    setEditText('')
    setEditTime('')
    setIsEditingReminder(false)
  }

  return (
    <section className="dashboard-page">
      {/* 今日提醒 */}
      <div className="reminder-card">
        <div className="reminder-card-header">
          <span className="material-symbols-outlined">notifications_active</span>
          <strong>今日提醒</strong>
        </div>
        {isEditingReminder ? (
          <div className="reminder-edit">
            <textarea
              className="reminder-input"
              value={editText}
              onChange={e => setEditText(e.target.value)}
              placeholder="输入今天的提醒消息..."
              rows={2}
              autoFocus
            />
            <div className="reminder-time-row">
              <span className="material-symbols-outlined reminder-time-icon">alarm</span>
              <input
                type="time"
                className="reminder-time-input"
                value={editTime}
                onChange={e => setEditTime(e.target.value)}
              />
              {editTime && (
                <button
                  type="button"
                  className="reminder-time-clear"
                  onClick={() => setEditTime('')}
                  aria-label="清除时间"
                >
                  ×
                </button>
              )}
            </div>
            <div className="reminder-edit-actions">
              <button className="reminder-btn cancel" onClick={cancelEdit}>取消</button>
              <button className="reminder-btn save" onClick={saveReminder}>保存</button>
            </div>
          </div>
        ) : (
          <div className="reminder-display" onClick={startEditReminder}>
            {reminderMsg ? (
              <>
                <p className="reminder-text">{reminderMsg}</p>
                {reminderTime && (
                  <span className="reminder-time-badge">
                    <span className="material-symbols-outlined">alarm</span>
                    {reminderTime}
                  </span>
                )}
              </>
            ) : (
              <p className="reminder-placeholder">点击设置今日提醒</p>
            )}
            <span className="material-symbols-outlined reminder-edit-icon">edit</span>
          </div>
        )}
      </div>

      <div className="dashboard-actions">
        <button className="home-action primary" onClick={() => onNavigate('daily')}>
          <span className="material-symbols-outlined">bolt</span>
          <strong>今日任务</strong>
          <small>{todayPending > 0 ? `${todayPending} 项待处理` : '今天很清爽'}</small>
        </button>

        <button className="home-action" onClick={() => onNavigate('long')}>
          <span className="material-symbols-outlined">flag</span>
          <strong>长期目标</strong>
          <small>{activeLongTasks.length > 0 ? `${activeLongTasks.length} 项进行中` : '暂无进行中的长期目标'}</small>
        </button>

        <button className="home-action" onClick={() => onNavigate('vault')}>
          <span className="material-symbols-outlined">key</span>
          <strong>密码库</strong>
          <small>管理常用账号信息</small>
        </button>
      </div>
    </section>
  )
}
