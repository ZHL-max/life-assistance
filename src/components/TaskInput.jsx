import { useState, useRef } from 'react'
import './TaskInput.css'

const COLORS = [
  { key: '', label: '默认' },
  { key: 'red', label: '红色' },
  { key: 'blue', label: '蓝色' },
  { key: 'green', label: '绿色' },
  { key: 'yellow', label: '黄色' },
  { key: 'purple', label: '紫色' },
  { key: 'orange', label: '橙色' },
]

export default function TaskInput({ onAdd }) {
  const [value, setValue] = useState('')
  const [repeatDaily, setRepeatDaily] = useState(false)
  const [color, setColor] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const inputRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!value.trim()) return
    onAdd(value, { repeatDaily, color, reminderTime })
    setValue('')
    setColor('')
    setReminderTime('')
    inputRef.current?.focus()
  }

  return (
    <form className="task-input-form" onSubmit={handleSubmit}>
      <div className="task-input-wrapper glass-card">
        <span className="material-symbols-outlined input-icon" aria-hidden="true">edit_note</span>
        <input
          ref={inputRef}
          id="task-input"
          className="task-input"
          type="text"
          placeholder="添加一项今日任务..."
          value={value}
          onChange={e => setValue(e.target.value)}
          autoComplete="off"
          maxLength={120}
        />
        <button
          type="button"
          className={`repeat-toggle ${repeatDaily ? 'active' : ''}`}
          onClick={() => setRepeatDaily(value => !value)}
          aria-label={repeatDaily ? '取消每天重复' : '设为每天重复'}
          aria-pressed={repeatDaily}
        >
          <span className="material-symbols-outlined repeat-bolt">event_repeat</span>
          <span>每天</span>
        </button>
        <button
          type="submit"
          className="add-btn"
          disabled={!value.trim()}
          aria-label="添加任务"
        >
          <span className="add-btn-icon">+</span>
          <span className="add-btn-text">添加</span>
        </button>
      </div>

      <div className="task-input-extras">
        <div className="color-picker" role="radiogroup" aria-label="任务颜色">
          {COLORS.map(c => (
            <button
              key={c.key}
              type="button"
              className={`color-dot ${color === c.key ? 'active' : ''}`}
              data-color={c.key}
              onClick={() => setColor(c.key)}
              aria-label={c.label}
              title={c.label}
            />
          ))}
        </div>

        <label className="reminder-picker">
          <span className="material-symbols-outlined reminder-icon">alarm</span>
          <input
            type="time"
            value={reminderTime}
            onChange={e => setReminderTime(e.target.value)}
            className="reminder-time-input"
          />
          {reminderTime && (
            <button
              type="button"
              className="reminder-clear"
              onClick={() => setReminderTime('')}
              aria-label="清除提醒时间"
            >
              ×
            </button>
          )}
        </label>
      </div>
    </form>
  )
}
