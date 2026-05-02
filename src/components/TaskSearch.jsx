import { useMemo, useState } from 'react'
import './TaskSearch.css'

function formatDateLabel(dateKey) {
  const [year, month, day] = dateKey.split('-')
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const date = new Date(Number(year), Number(month) - 1, Number(day))

  return `${month}月${day}日 ${weekdays[date.getDay()]}`
}

export default function TaskSearch({ tasks, onSelectDate }) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()

  const results = useMemo(() => {
    if (!normalizedQuery) return []

    return tasks
      .filter(task => task.text.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        const byDate = (b.date ?? '').localeCompare(a.date ?? '')
        if (byDate !== 0) return byDate

        return (b.createdAt ?? 0) - (a.createdAt ?? 0)
      })
      .slice(0, 8)
  }, [normalizedQuery, tasks])

  return (
    <section className="task-search" aria-label="全局搜索">
      <label className="task-search-box">
        <span className="material-symbols-outlined">search</span>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="搜索所有任务..."
          type="search"
        />
      </label>

      {normalizedQuery && (
        <div className="search-results">
          {results.length === 0 ? (
            <p className="search-empty">没有找到匹配的任务。</p>
          ) : (
            results.map(task => (
              <button
                key={task.id}
                className="search-result"
                onClick={() => onSelectDate(task.date)}
              >
                <span className={`search-status ${task.done ? 'done' : ''}`} />
                <span className="search-main">
                  <span className={`search-text ${task.done ? 'done' : ''}`}>{task.text}</span>
                  <span className="search-date">{formatDateLabel(task.date)}</span>
                </span>
                <span className="search-tags">
                  {task.pinned && <span className="search-tag">置顶</span>}
                  {task.repeat === 'daily' && <span className="search-tag spark">每天</span>}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </section>
  )
}
