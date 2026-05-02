import { useEffect, useRef, useState } from 'react'
import './TaskItem.css'

export default function TaskItem({ task, onToggle, onDelete, onEdit, onPin, onStopRepeat }) {
  const [removing, setRemoving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(task.text)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!isEditing) return

    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  const handleDelete = () => {
    setRemoving(true)
    setTimeout(() => onDelete(task.id), 320)
  }

  const startEditing = () => {
    if (removing) return
    setDraft(task.text)
    setIsEditing(true)
  }

  const commitEdit = () => {
    const nextText = draft.trim()

    if (nextText && nextText !== task.text) {
      onEdit(task.id, nextText)
    } else {
      setDraft(task.text)
    }

    setIsEditing(false)
  }

  const cancelEdit = () => {
    setDraft(task.text)
    setIsEditing(false)
  }

  const handleEditSubmit = (event) => {
    event.preventDefault()
    commitEdit()
  }

  const handleEditKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelEdit()
    }
  }

  const handleStopRepeat = () => {
    const shouldStop = window.confirm('取消这一组每日重复？已经生成的任务会保留。')
    if (shouldStop) onStopRepeat(task.id)
  }

  return (
    <li
      className={`task-item glass-card ${task.done ? 'done' : ''} ${task.pinned ? 'pinned' : ''} ${removing ? 'removing' : ''}`}
      data-color={task.color || undefined}
    >
      <button
        className={`checkbox ${task.done ? 'checked' : ''}`}
        onClick={() => onToggle(task.id)}
        aria-label={task.done ? '标记为未完成' : '标记为完成'}
        aria-pressed={task.done}
      >
        <svg className="check-icon" viewBox="0 0 16 16" fill="none">
          <path
            d="M3 8l3.5 3.5 6.5-7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <button
        className={`pin-btn ${task.pinned ? 'active' : ''}`}
        onClick={() => onPin(task.id)}
        aria-label={task.pinned ? '取消置顶' : '置顶任务'}
        aria-pressed={task.pinned}
        title={task.pinned ? '取消置顶' : '置顶任务'}
      >
        <span className="material-symbols-outlined">push_pin</span>
      </button>

      {task.repeat === 'daily' && (
        <button
          className="repeat-btn active"
          onClick={handleStopRepeat}
          aria-label="取消每日重复"
          title="每日重复"
        >
          <span className="material-symbols-outlined repeat-bolt">event_repeat</span>
        </button>
      )}

      {isEditing ? (
        <form className="task-edit-form" onSubmit={handleEditSubmit}>
          <input
            key={task.text}
            ref={inputRef}
            className="task-edit-input"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleEditKeyDown}
            maxLength={120}
            aria-label="编辑任务内容"
          />
        </form>
      ) : (
        <span className="task-text" onDoubleClick={startEditing}>
          {task.text}
          {task.reminderTime && (
            <span className="reminder-badge">
              <span className="material-symbols-outlined">alarm</span>
              {task.reminderTime}
            </span>
          )}
        </span>
      )}

      <button
        className="edit-btn"
        onClick={startEditing}
        aria-label="编辑任务"
        title="编辑任务"
      >
        <span className="material-symbols-outlined">edit</span>
      </button>

      <button
        className="delete-btn"
        onClick={handleDelete}
        aria-label="删除任务"
      >
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
          <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </li>
  )
}
