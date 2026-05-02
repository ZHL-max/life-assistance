import { useEffect, useState } from 'react'
import { fetchLongTasks } from '../storage/cloudLongTasks'
import './Dashboard.css'

function getTodayKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function Dashboard({ userId, tasks, onNavigate }) {
  const [longTasks, setLongTasks] = useState([])

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

  const todayTasks = tasks.filter(task => task.date === getTodayKey())
  const todayPending = todayTasks.filter(task => !task.done).length
  const activeLongTasks = longTasks.filter(task => task.status !== 'done')

  return (
    <section className="dashboard-page">
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
