import { useMemo, useState } from 'react'
import './Calendar.css'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const MONTHS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']

function formatKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getTodayKey() {
  const today = new Date()
  return formatKey(today.getFullYear(), today.getMonth(), today.getDate())
}

function getDateLabel(dateKey) {
  const [, m, d] = dateKey.split('-')
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const date = new Date(...dateKey.split('-').map((v, i) => i === 1 ? Number(v) - 1 : Number(v)))
  return `${m}月${d}日 ${weekdays[date.getDay()]}`
}

function getHeatLevel(count) {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  return 3
}

export default function Calendar({ selectedDate, allTasks, longTasks = [], scheduleEvents = [], onDayClick }) {
  const today = getTodayKey()
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const goToToday = () => {
    const now = new Date()
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
    onDayClick(getTodayKey())
  }

  const ddlDates = useMemo(() => {
    const set = new Set()
    for (const lt of longTasks) {
      if (lt.dueDate && lt.status !== 'done') {
        set.add(lt.dueDate)
      }
    }
    return set
  }, [longTasks])

  const selectedTasks = allTasks.filter(task => task.date === selectedDate)
  const selectedCourses = scheduleEvents.filter(event => event.eventDate === selectedDate)
  const selectedDDLs = longTasks.filter(lt => lt.dueDate === selectedDate && lt.status !== 'done')

  const getDayData = (dateKey) => {
    const tasks = allTasks.filter(task => task.date === dateKey)
    const courses = scheduleEvents.filter(event => event.eventDate === dateKey)
    return { tasks, courses, count: tasks.length + courses.length }
  }

  return (
    <section className="calendar-app-card">
      <div className="calendar-toolbar">
        <button onClick={prevMonth} aria-label="上一月">
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <div className="calendar-title">
          <h2>{MONTHS[viewMonth]}月</h2>
          <p>{viewYear}</p>
        </div>
        <button onClick={nextMonth} aria-label="下一月">
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
        <button className="calendar-today-btn" onClick={goToToday}>今天</button>
      </div>

      <div className="calendar-weekdays">
        {WEEKDAYS.map((day, i) => (
          <span key={day} className={i === 0 || i === 6 ? 'weekend' : ''}>{day}</span>
        ))}
      </div>

      <div className="calendar-month-grid">
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="calendar-day empty" />

          const dateKey = formatKey(viewYear, viewMonth, day)
          const { tasks, courses, count } = getDayData(dateKey)
          const heat = getHeatLevel(count)
          const isToday = dateKey === today
          const isSelected = dateKey === selectedDate
          const hasDDL = ddlDates.has(dateKey)
          const dayOfWeek = new Date(viewYear, viewMonth, day).getDay()
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

          const visibleTasks = tasks.slice(0, 2)
          const visibleCourses = courses.slice(0, 1)
          const moreCount = Math.max(0, tasks.length + courses.length - 3)

          return (
            <button
              key={dateKey}
              className={`calendar-day heat-${heat} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => onDayClick(dateKey)}
            >
              <div className="calendar-day-header">
                <span className={`calendar-day-number ${isWeekend ? 'weekend' : ''}`}>
                  {day}
                </span>
                {hasDDL && <span className="ddl-dot" title="有 DDL 截止" />}
              </div>
              <div className="calendar-day-items">
                {courses.map(c => (
                  <span key={`c-${c.id}`} className="calendar-pill course">{c.title}</span>
                ))}
                {visibleTasks.map(t => (
                  <span key={`t-${t.id}`} className={`calendar-pill ${t.done ? 'task-done' : 'task'}`}>{t.text}</span>
                ))}
                {moreCount > 0 && (
                  <span className="calendar-more">+{moreCount}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <section className="calendar-detail">
        <h3 className="detail-date-label">{getDateLabel(selectedDate)}</h3>

        {selectedCourses.length === 0 && selectedTasks.length === 0 && selectedDDLs.length === 0 && (
          <p className="calendar-empty">这天还没有安排。</p>
        )}

        {selectedCourses.length > 0 && (
          <div className="detail-section">
            <p className="detail-section-title">
              <span className="material-symbols-outlined">school</span>
              课程
            </p>
            <div className="detail-cards">
              {selectedCourses.map(course => (
                <div key={`course-${course.id}`} className="detail-card course-card">
                  <strong>{course.title}</strong>
                  <span className="detail-meta">
                    <span className="material-symbols-outlined">schedule</span>
                    {course.startSection}-{course.endSection}节
                  </span>
                  {course.location && (
                    <span className="detail-meta">
                      <span className="material-symbols-outlined">location_on</span>
                      {course.location}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedTasks.length > 0 && (
          <div className="detail-section">
            <p className="detail-section-title">
              <span className="material-symbols-outlined">checklist</span>
              任务
            </p>
            <div className="detail-cards">
              {selectedTasks.map(task => (
                <div key={`task-${task.id}`} className={`detail-card task-card ${task.done ? 'done' : ''}`} data-color={task.color || undefined}>
                  <strong>{task.text}</strong>
                  <span className="detail-meta">{task.done ? '已完成' : '待完成'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedDDLs.length > 0 && (
          <div className="detail-section">
            <p className="detail-section-title">
              <span className="material-symbols-outlined">event_busy</span>
              DDL 截止
            </p>
            <div className="detail-cards">
              {selectedDDLs.map(lt => (
                <div key={`ddl-${lt.id}`} className="detail-card ddl-card">
                  <strong>{lt.title}</strong>
                  <span className="detail-meta">{lt.category === 'project' ? '项目' : '学科竞赛'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </section>
  )
}
