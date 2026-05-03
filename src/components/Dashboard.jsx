import { useEffect, useRef, useState } from 'react'
import { fetchLongTasks } from '../storage/cloudLongTasks'
import { loadDailyReminders, saveDailyReminders } from '../storage/dailyReminder'
import { fetchCloudReminders, replaceCloudReminders } from '../storage/cloudReminders'
import { registerPushSubscription, checkPushSubscription } from '../storage/pushSubscription'
import { getTodayKey } from '../utils/date'
import './Dashboard.css'

export default function Dashboard({ userId, tasks, onNavigate }) {
  const [longTasks, setLongTasks] = useState([])
  const [reminders, setReminders] = useState([])
  const [isAdding, setIsAdding] = useState(false)
  const [editText, setEditText] = useState('')
  const [editTime, setEditTime] = useState('')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const remindersRef = useRef(reminders)
  useEffect(() => { remindersRef.current = reminders }, [reminders])

  const todayKey = getTodayKey()

  useEffect(() => {
    let ignore = false
    async function load() {
      try {
        const loaded = await fetchLongTasks(userId)
        if (!ignore) setLongTasks(loaded)
      } catch {
        if (!ignore) setLongTasks([])
      }
    }
    load()
    return () => { ignore = true }
  }, [userId])

  // 检查推送订阅状态
  useEffect(() => {
    checkPushSubscription().then(setPushEnabled).catch(() => {})
  }, [])

  // 加载提醒
  useEffect(() => {
    let ignore = false

    async function loadReminders() {
      try {
        const cloudData = await fetchCloudReminders(userId)
        if (ignore) return
        const todayReminders = cloudData[todayKey] || []
        setReminders(todayReminders)
        saveDailyReminders(todayKey, todayReminders)
      } catch {
        if (ignore) return
        const local = loadDailyReminders(todayKey)
        setReminders(local)
      }
    }

    loadReminders()
    return () => { ignore = true }
  }, [userId, todayKey])

  const todayTasks = tasks.filter(task => task.date === todayKey)
  const todayPending = todayTasks.filter(task => !task.done).length
  const activeLongTasks = longTasks.filter(task => task.status !== 'done')

  const syncReminders = async (dateKey, next) => {
    saveDailyReminders(dateKey, next)
    try {
      const cloudData = await fetchCloudReminders(userId)
      // Use ref to get the latest state, avoiding stale closure from rapid calls
      cloudData[dateKey] = remindersRef.current
      await replaceCloudReminders(cloudData, userId)
    } catch {
      // 云端同步失败，本地已保存
    }
  }

  const handleEnablePush = async () => {
    setPushLoading(true)
    try {
      await registerPushSubscription(userId)
      setPushEnabled(true)
    } catch (error) {
      alert(error.message)
    } finally {
      setPushLoading(false)
    }
  }

  const handleAdd = async () => {
    const msg = editText.trim()
    if (!msg) return

    // 如果还没开启推送，先开启
    if (!pushEnabled) {
      try {
        await registerPushSubscription(userId)
        setPushEnabled(true)
      } catch {
        // 用户拒绝了权限，仍然允许添加提醒（App 打开时会通过服务端推送）
      }
    }

    const newReminder = {
      id: crypto.randomUUID(),
      message: msg,
      time: editTime || '',
    }
    const next = [...reminders, newReminder]
    setReminders(next)
    syncReminders(todayKey, next)
    setEditText('')
    setEditTime('')
    setIsAdding(false)
  }

  const handleDelete = (id) => {
    const next = reminders.filter(r => r.id !== id)
    setReminders(next)
    syncReminders(todayKey, next)
  }

  return (
    <section className="dashboard-page">
      {/* 今日提醒 */}
      <div className="reminder-card">
        <div className="reminder-card-header">
          <span className="material-symbols-outlined">notifications_active</span>
          <strong>今日提醒</strong>
          {!isAdding && (
            <button className="reminder-add-btn" onClick={() => setIsAdding(true)} aria-label="添加提醒">
              <span className="material-symbols-outlined">add</span>
            </button>
          )}
        </div>

        {/* 推送通知开启按钮 */}
        {!pushEnabled && 'Notification' in window && Notification.permission !== 'denied' && (
          <button className="push-enable-btn" onClick={handleEnablePush} disabled={pushLoading}>
            <span className="material-symbols-outlined">notifications</span>
            {pushLoading ? '正在开启...' : '开启推送通知（关掉 App 也能收到提醒）'}
          </button>
        )}

        {/* 提醒列表 */}
        {reminders.length > 0 && (
          <div className="reminder-list">
            {reminders.map(r => (
              <div key={r.id} className="reminder-item">
                <div className="reminder-item-body">
                  <p className="reminder-text">{r.message}</p>
                  {r.time && (
                    <span className="reminder-time-badge">
                      <span className="material-symbols-outlined">alarm</span>
                      {r.time}
                    </span>
                  )}
                </div>
                <button
                  className="reminder-delete-btn"
                  onClick={() => handleDelete(r.id)}
                  aria-label="删除提醒"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 添加表单 */}
        {isAdding ? (
          <div className="reminder-edit">
            <textarea
              className="reminder-input"
              value={editText}
              onChange={e => setEditText(e.target.value)}
              placeholder="输入提醒消息..."
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
                <button type="button" className="reminder-time-clear" onClick={() => setEditTime('')}>×</button>
              )}
            </div>
            <div className="reminder-edit-actions">
              <button className="reminder-btn cancel" onClick={() => { setIsAdding(false); setEditText(''); setEditTime('') }}>取消</button>
              <button className="reminder-btn save" onClick={handleAdd} disabled={!editText.trim()}>添加</button>
            </div>
          </div>
        ) : (
          reminders.length === 0 && (
            <p className="reminder-placeholder" onClick={() => setIsAdding(true)}>点击添加今日提醒</p>
          )
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
