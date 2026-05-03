import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getBuaaStatus,
  getBuaaTerms,
  getBuaaWeeklySchedule,
  getBuaaWeeks,
} from '../storage/buaaConnector'
import { fetchScheduleEvents, importScheduleEvents } from '../storage/cloudSchedule'
import { loadLocalScheduleEvents, saveLocalScheduleEvents } from '../storage/localSchedule'
import { getCurrentWeekMonday, parseBeihangWeeklySchedule } from '../utils/courseImport'
import './Schedule.css'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const SECTION_COUNT = 14
const COURSE_COLORS = ['#d9554f', '#5d86df', '#f1c84c', '#42a5a4', '#8a78d6', '#ef8a4c']

const SECTION_TIMES = {
  1: '08:00',
  2: '08:50',
  3: '09:50',
  4: '10:40',
  5: '11:30',
  6: '14:00',
  7: '14:50',
  8: '15:50',
  9: '16:40',
  10: '17:30',
  11: '19:00',
  12: '19:50',
  13: '20:40',
  14: '21:30',
}

function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(dateKey, offset) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + offset)
  return formatDateKey(date)
}

function formatShortDate(dateKey) {
  return dateKey.slice(5).replace('-', '.')
}

function formatRangeDate(dateKey) {
  return dateKey.replaceAll('-', '.')
}

function getWeekStartFromTermWeek(week) {
  return String(week?.startDate ?? '').slice(0, 10)
}

function getTermRange(termWeeks) {
  const weekStarts = termWeeks
    .map(getWeekStartFromTermWeek)
    .filter(Boolean)
    .sort()

  return {
    firstWeekStart: weekStarts[0] ?? '',
    lastWeekStart: weekStarts.at(-1) ?? '',
  }
}

function toBuaaSourceTerm(termCode) {
  return String(termCode ?? '').replaceAll('-', '')
}

function getCourseColor(title) {
  let hash = 0
  for (const char of title) hash = (hash + char.charCodeAt(0)) % COURSE_COLORS.length
  return COURSE_COLORS[hash]
}

function getEventTime(event) {
  const start = event.startTime ?? SECTION_TIMES[event.startSection] ?? ''
  const end = event.endTime ?? SECTION_TIMES[event.endSection] ?? ''
  return start && end ? `${start}-${end}` : `第 ${event.startSection}-${event.endSection} 节`
}

function getWeekLabel(weekStart, termWeeks) {
  const week = termWeeks.find(item => String(item.startDate ?? '').slice(0, 10) === weekStart)
  const rangeLabel = `${formatRangeDate(weekStart)} ~ ${formatRangeDate(addDays(weekStart, 6))}`
  return week?.name ? `${week.name} · ${rangeLabel}` : rangeLabel
}

export default function Schedule({ userId }) {
  const cachedEventsRef = useRef([])
  const [weekEvents, setWeekEvents] = useState([])
  const [weekStart, setWeekStart] = useState(getCurrentWeekMonday())
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingWeek, setLoadingWeek] = useState(false)
  const [buaaStatus, setBuaaStatus] = useState('未登录北航')
  const [buaaTerms, setBuaaTerms] = useState([])
  const [termWeeks, setTermWeeks] = useState([])
  const [termWeeksTerm, setTermWeeksTerm] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [autoSyncedTerm, setAutoSyncedTerm] = useState('')
  const syncRequestRef = useRef(0)
  const weekRequestRef = useRef(0)

  useEffect(() => {
    let ignore = false

    async function loadSchedule() {
      try {
        const loaded = await fetchScheduleEvents(userId)
        if (!ignore) {
          cachedEventsRef.current = loaded
          setMessage('')
        }
      } catch (error) {
        if (!ignore) {
          const localEvents = loadLocalScheduleEvents(userId)
          cachedEventsRef.current = localEvents
          setMessage(localEvents.length > 0
            ? '云端课程表暂不可用，已读取本机课程缓存。'
            : `课程表读取失败：${error.message}`)
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    async function loadBuaaStatus() {
      try {
        const status = await getBuaaStatus()
        if (ignore) return

        if (status.connected) {
          setBuaaStatus(`已登录：${status.user?.userName ?? status.user?.userId ?? '北航账号'}`)
          const terms = await getBuaaTerms()
          if (ignore) return

          const nextTerms = terms.datas ?? []
          const current = nextTerms.find(term => term.selected)?.itemCode || nextTerms.at(-1)?.itemCode || ''
          setBuaaTerms(nextTerms)
          setSelectedTerm(prev => prev || current)
        }
      } catch {
        if (!ignore) setBuaaStatus('未登录北航')
      }
    }

    loadSchedule()
    loadBuaaStatus()

    return () => {
      ignore = true
    }
  }, [userId])

  const weekDates = useMemo(() => (
    Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  ), [weekStart])

  const selectedTermName = useMemo(() => (
    buaaTerms.find(term => term.itemCode === selectedTerm)?.itemName || selectedTerm
  ), [buaaTerms, selectedTerm])

  const activeTermWeeks = useMemo(() => (
    termWeeksTerm === selectedTerm ? termWeeks : []
  ), [selectedTerm, termWeeks, termWeeksTerm])
  const termRange = useMemo(() => getTermRange(activeTermWeeks), [activeTermWeeks])
  const selectedWeekIndex = activeTermWeeks.findIndex(
    week => getWeekStartFromTermWeek(week) === weekStart
  )
  const selectedWeek = selectedWeekIndex >= 0 ? activeTermWeeks[selectedWeekIndex] : null
  const isFirstTermWeek = selectedWeekIndex <= 0
  const isLastTermWeek = selectedWeekIndex < 0 || selectedWeekIndex >= activeTermWeeks.length - 1

  const loadTerms = async () => {
    const terms = await getBuaaTerms()
    const nextTerms = terms.datas ?? []
    const current = nextTerms.find(term => term.selected)?.itemCode || nextTerms.at(-1)?.itemCode || ''
    setBuaaTerms(nextTerms)
    setSelectedTerm(prev => prev || current)
  }

  const syncTerm = async (termCode, options = {}) => {
    if (!termCode) {
      setMessage('请先登录并选择学期。')
      return
    }

    const requestId = syncRequestRef.current + 1
    syncRequestRef.current = requestId
    setTermWeeks([])
    setTermWeeksTerm('')
    if (!options.silent) setMessage('')

    try {
      const weeks = await getBuaaWeeks(termCode)
      if (syncRequestRef.current !== requestId) return

      const weekList = weeks.datas ?? []
      const currentWeek = weekList.find(item => item.curWeek) ?? weekList[0]
      setTermWeeks(weekList)
      setTermWeeksTerm(termCode)
      if (currentWeek?.startDate) setWeekStart(String(currentWeek.startDate).slice(0, 10))

      setAutoSyncedTerm(termCode)
      if (!options.silent) setMessage(`已加载 ${weekList.length} 个教学周。`)
    } catch (error) {
      if (syncRequestRef.current !== requestId) return

      const text = String(error?.message ?? '')
      if (text.includes('登录状态已失效')) {
        setBuaaStatus('未登录北航')
        setMessage('同步北航课表失败：登录已失效，请重新登录北航账号。')
      } else {
        setMessage(`同步北航课表失败：${text || '未知错误'}`)
      }
    } finally {
      // sync complete
    }
  }

  useEffect(() => {
    if (!selectedTerm || autoSyncedTerm === selectedTerm) return
    syncTerm(selectedTerm, { silent: true })
    // 只在学期变化时触发自动同步。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTerm])

  useEffect(() => {
    if (!termRange.firstWeekStart || !termRange.lastWeekStart) return

    setWeekStart(current => {
      if (current < termRange.firstWeekStart) return termRange.firstWeekStart
      if (current > termRange.lastWeekStart) return termRange.lastWeekStart
      return current
    })
  }, [termRange.firstWeekStart, termRange.lastWeekStart])

  useEffect(() => {
    if (!selectedTerm || !selectedWeek) {
      setWeekEvents([])
      return
    }

    const requestId = weekRequestRef.current + 1
    weekRequestRef.current = requestId
    const weekEnd = addDays(weekStart, 6)
    setLoadingWeek(true)
    setWeekEvents([])

    async function loadSelectedWeek() {
      try {
        const schedule = await getBuaaWeeklySchedule(selectedTerm, selectedWeek.serialNumber)
        if (weekRequestRef.current !== requestId) return

        const parsedEvents = parseBeihangWeeklySchedule(
          schedule,
          weekStart,
          selectedWeek.serialNumber
        ).sort((a, b) => a.startSection - b.startSection)

        setWeekEvents(parsedEvents)

        try {
          const saved = await importScheduleEvents(userId, parsedEvents, {
            replaceRangeStart: weekStart,
            replaceRangeEnd: weekEnd,
          })
          cachedEventsRef.current = saved
          saveLocalScheduleEvents(userId, saved)
        } catch {
          // The UI follows BUAA's live weekly response. Persistence is best-effort.
        }
      } catch (error) {
        if (weekRequestRef.current !== requestId) return

        const sourceTerm = toBuaaSourceTerm(selectedTerm)
        const fallbackEvents = cachedEventsRef.current
          .filter(event => weekDates.includes(event.eventDate))
          .filter(event => String(event.source ?? '').includes(sourceTerm))
          .sort((a, b) => a.startSection - b.startSection)
        setWeekEvents(fallbackEvents)
        if (fallbackEvents.length === 0) {
          setMessage(`读取本周课表失败：${error.message}`)
        }
      } finally {
        if (weekRequestRef.current === requestId) setLoadingWeek(false)
      }
    }

    loadSelectedWeek()
  }, [selectedTerm, selectedWeek, userId, weekDates, weekStart])

  const handleTermChange = value => {
    syncRequestRef.current += 1
    setSelectedTerm(value)
    setTermWeeks([])
    setTermWeeksTerm('')
    setSelectedCourse(null)
    setMessage('')
  }

  const moveWeek = offset => {
    if (selectedWeekIndex < 0 || activeTermWeeks.length === 0) return

    const direction = offset > 0 ? 1 : -1
    const nextIndex = Math.min(
      Math.max(selectedWeekIndex + direction, 0),
      activeTermWeeks.length - 1
    )
    const nextWeekStart = getWeekStartFromTermWeek(activeTermWeeks[nextIndex])
    if (nextWeekStart) setWeekStart(nextWeekStart)
  }

  return (
    <section className="schedule-app">
      <div className="schedule-topbar">
        <div className="schedule-title-row">
          <button className="schedule-icon-btn" onClick={() => moveWeek(-7)} disabled={isFirstTermWeek}>‹</button>
          <div>
          <h2>{selectedTermName || '课表'}</h2>
          <p>{activeTermWeeks.length > 0 ? getWeekLabel(weekStart, activeTermWeeks) : '正在同步学期周次...'} · {buaaStatus}</p>
        </div>
        <button className="schedule-icon-btn" onClick={() => moveWeek(7)} disabled={isLastTermWeek}>›</button>
      </div>

      <div className="schedule-login-strip">
          <select value={selectedTerm} onChange={event => handleTermChange(event.target.value)}>
            <option value="">选择学期</option>
            {buaaTerms.map(term => (
              <option key={term.itemCode} value={term.itemCode}>
                {term.itemName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message && <p className="schedule-message slim">{message}</p>}
      {loading && <p className="schedule-empty">正在读取课程表...</p>}
      {loadingWeek && <p className="schedule-empty">正在读取本周课表...</p>}

      {!loading && (
        <div className="course-grid-wrap">
          <div className="course-grid">
            <div className="grid-corner">节次</div>
            {weekDates.map((date, index) => (
              <div key={date} className="grid-day-head">
                <strong>{WEEKDAYS[index]}</strong>
                <span>{formatShortDate(date)}</span>
              </div>
            ))}

            {Array.from({ length: SECTION_COUNT }, (_, index) => index + 1).map(section => (
              <div key={`section-${section}`} className="grid-section" style={{ gridRow: section + 1 }}>
                {section}
              </div>
            ))}

            {Array.from({ length: SECTION_COUNT }, (_, row) => (
              weekDates.map((date, column) => (
                <div
                  key={`${date}-${row}`}
                  className="grid-cell"
                  style={{ gridColumn: column + 2, gridRow: row + 2 }}
                />
              ))
            )).flat()}

            {weekEvents.map(event => (
              <button
                key={event.id}
                className="grid-course"
                style={{
                  gridColumn: event.weekday + 1,
                  gridRow: `${event.startSection + 1} / ${event.endSection + 2}`,
                  background: getCourseColor(event.title),
                }}
                onClick={() => setSelectedCourse(event)}
              >
                <strong>{event.title}</strong>
                <span>{event.location}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedCourse && (
        <div className="course-modal-backdrop" onClick={() => setSelectedCourse(null)}>
          <article className="course-modal" onClick={event => event.stopPropagation()}>
            <h3>{selectedCourse.title}</h3>
            <dl>
              <dt>任课教师</dt>
              <dd>{selectedCourse.teacher || '未填写'}</dd>
              <dt>时间</dt>
              <dd>{getEventTime(selectedCourse)}</dd>
              <dt>地点</dt>
              <dd>{selectedCourse.location || '未填写'}</dd>
              <dt>上课周次</dt>
              <dd>{selectedCourse.weeks || '未填写'}</dd>
              <dt>课程编号</dt>
              <dd>{selectedCourse.source?.split('·')[1]?.trim() || '未填写'}</dd>
            </dl>
            <button onClick={() => setSelectedCourse(null)}>确定</button>
          </article>
        </div>
      )}
    </section>
  )
}
