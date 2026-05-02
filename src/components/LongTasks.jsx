import { useEffect, useState } from 'react'
import {
  createLongTask,
  deleteLongTask,
  deleteLongTaskFile,
  fetchLongTasks,
  openLongTaskFile,
  updateLongTask,
  uploadLongTaskFile,
} from '../storage/cloudLongTasks'
import './LongTasks.css'

const STATUS_LABELS = {
  active: '进行中',
  paused: '暂停',
  done: '已完成',
}

const CATEGORY_LABELS = {
  competition: '学科竞赛',
  project: '项目',
}

const CATEGORY_ICONS = {
  competition: 'emoji_events',
  project: 'rocket_launch',
}

function getTodayKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatFileSize(size) {
  if (!size) return '未知大小'
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`

  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function getDueMeta(dueDate) {
  if (!dueDate) return { label: '未设置 DDL', tone: 'quiet' }

  const today = getTodayKey()
  const due = new Date(`${dueDate}T00:00:00`)
  const now = new Date(`${today}T00:00:00`)
  const days = Math.round((due - now) / 86400000)

  if (days < 0) return { label: `已超期 ${Math.abs(days)} 天`, tone: 'danger' }
  if (days === 0) return { label: '今天截止', tone: 'urgent' }
  if (days <= 3) return { label: `${days} 天后截止`, tone: 'urgent' }

  return { label: `${days} 天后截止`, tone: 'calm' }
}

export default function LongTasks({ userId }) {
  const [longTasks, setLongTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState({ title: '', category: 'competition', dueDate: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showComposer, setShowComposer] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    let ignore = false

    async function loadLongTasks() {
      try {
        const tasks = await fetchLongTasks(userId)
        if (!ignore) {
          setLongTasks(tasks)
          setMessage('')
        }
      } catch (error) {
        console.error('Failed to fetch long tasks:', error)
        if (!ignore) {
          setMessage(`竞赛与项目暂时读取失败：${error.message}`)
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadLongTasks()

    return () => {
      ignore = true
    }
  }, [userId])

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!draft.title.trim() || saving) return

    setSaving(true)
    setMessage('')

    try {
      const nextTask = await createLongTask(userId, {
        title: draft.title.trim(),
        category: draft.category,
        dueDate: draft.dueDate,
        notes: draft.notes.trim(),
      })
      setLongTasks(prev => [nextTask, ...prev])
      setDraft({ title: '', category: 'competition', dueDate: '', notes: '' })
      setShowComposer(false)
    } catch (error) {
      console.error('Failed to create long task:', error)
      setMessage(`创建失败：${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (task, updates) => {
    const nextTask = {
      ...task,
      ...updates,
    }

    setLongTasks(prev => prev.map(item => (
      item.id === task.id ? nextTask : item
    )))
    setMessage('')

    try {
      const saved = await updateLongTask(userId, task.id, nextTask)
      setLongTasks(prev => prev.map(item => (
        item.id === task.id ? { ...item, ...saved } : item
      )))
    } catch (error) {
      console.error('Failed to update long task:', error)
      setMessage(`保存失败：${error.message}`)
    }
  }

  const handleDelete = async (task) => {
    const confirmed = window.confirm(`删除「${task.title}」？关联文件也会一起删除。`)
    if (!confirmed) return

    setLongTasks(prev => prev.filter(item => item.id !== task.id))

    try {
      await deleteLongTask(userId, task.id)
    } catch (error) {
      console.error('Failed to delete long task:', error)
      setMessage(`删除失败：${error.message}`)
    }
  }

  const handleUpload = async (task, fileList) => {
    const file = fileList?.[0]
    if (!file) return

    setMessage('')

    try {
      const uploaded = await uploadLongTaskFile(userId, task.id, file)
      setLongTasks(prev => prev.map(item => (
        item.id === task.id ? { ...item, files: [uploaded, ...item.files] } : item
      )))
    } catch (error) {
      console.error('Failed to upload long task file:', error)
      setMessage(`文件上传失败：${error.message}`)
    }
  }

  const handleDeleteFile = async (task, file) => {
    const confirmed = window.confirm(`删除文件「${file.fileName}」？`)
    if (!confirmed) return

    setLongTasks(prev => prev.map(item => (
      item.id === task.id
        ? { ...item, files: item.files.filter(current => current.id !== file.id) }
        : item
    )))

    try {
      await deleteLongTaskFile(userId, task.id, file.id)
    } catch (error) {
      console.error('Failed to delete long task file:', error)
      setMessage(`文件删除失败：${error.message}`)
    }
  }

  const filteredTasks = categoryFilter === 'all'
    ? longTasks
    : longTasks.filter(t => t.category === categoryFilter)

  return (
    <section className="long-tasks-page">
      {message && <p className="long-message">{message}</p>}

      <div className="filter-bar">
        {[
          { value: 'all', label: '全部' },
          { value: 'competition', label: '学科竞赛' },
          { value: 'project', label: '项目' },
        ].map(f => (
          <button
            key={f.value}
            className={`filter-chip ${categoryFilter === f.value ? 'active' : ''}`}
            onClick={() => setCategoryFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p className="long-empty">正在读取...</p>}
      {!loading && longTasks.length === 0 && (
        <div className="long-empty">
          <span className="material-symbols-outlined">emoji_events</span>
          <p>还没有竞赛或项目。点击下方 + 开始添加吧。</p>
        </div>
      )}
      {!loading && longTasks.length > 0 && filteredTasks.length === 0 && (
        <div className="long-empty">
          <p>该分类下暂无内容。</p>
        </div>
      )}

      <div className="long-task-list">
        {filteredTasks.map(task => {
          const due = getDueMeta(task.dueDate)
          const isEditing = editingId === task.id
          const category = task.category || 'competition'

          return (
            <article key={task.id} className={`long-task-card ${task.status}`}>
              <div className="long-card-head">
                <div>
                  <div className="long-title-row">
                    <span className={`long-category-badge cat-${category}`}>
                      <span className="material-symbols-outlined">{CATEGORY_ICONS[category]}</span>
                      {CATEGORY_LABELS[category]}
                    </span>
                  </div>
                  {isEditing ? (
                    <input
                      className="long-title-input"
                      value={task.title}
                      onChange={event => setLongTasks(prev => prev.map(item => (
                        item.id === task.id ? { ...item, title: event.target.value } : item
                      )))}
                      onBlur={() => handleUpdate(task, { title: task.title.trim() || '未命名' })}
                    />
                  ) : (
                    <h3>{task.title}</h3>
                  )}
                  <div className="long-meta">
                    <span className={`long-due ${due.tone}`}>{due.label}</span>
                    <span>{task.files.length} 个文件</span>
                  </div>
                </div>

                <select
                  className="long-status"
                  value={task.status}
                  onChange={event => handleUpdate(task, { status: event.target.value })}
                  aria-label="任务状态"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <label className="long-field compact">
                <span>DDL</span>
                <input
                  type="date"
                  value={task.dueDate ?? ''}
                  onChange={event => handleUpdate(task, { dueDate: event.target.value })}
                />
              </label>

              <label className="long-field wide compact">
                <span>说明</span>
                <textarea
                  value={task.notes}
                  onChange={event => setLongTasks(prev => prev.map(item => (
                    item.id === task.id ? { ...item, notes: event.target.value } : item
                  )))}
                  onBlur={() => handleUpdate(task, { notes: task.notes })}
                  rows={3}
                  placeholder="补充说明、拆解步骤、相关链接..."
                />
              </label>

              <div className="long-file-row">
                <label className="long-upload">
                  <span className="material-symbols-outlined">upload_file</span>
                  上传文件
                  <input
                    type="file"
                    onChange={event => {
                      handleUpload(task, event.target.files)
                      event.target.value = ''
                    }}
                  />
                </label>
                <button className="long-ghost-btn" type="button" onClick={() => setEditingId(isEditing ? null : task.id)}>
                  {isEditing ? '收起编辑' : '编辑标题'}
                </button>
                <button className="long-danger-btn" type="button" onClick={() => handleDelete(task)}>
                  删除
                </button>
              </div>

              {task.files.length > 0 && (
                <ul className="long-files">
                  {task.files.map(file => (
                    <li key={file.id}>
                      <button type="button" onClick={() => openLongTaskFile(file)}>
                        <span className="material-symbols-outlined">description</span>
                        <span>{file.fileName}</span>
                        <small>{formatFileSize(file.fileSize)}</small>
                      </button>
                      <button
                        className="file-delete"
                        type="button"
                        onClick={() => handleDeleteFile(task, file)}
                        aria-label="删除文件"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          )
        })}
      </div>

      <button className="fab-add" onClick={() => setShowComposer(true)} aria-label="添加竞赛或项目">
        +
      </button>

      {showComposer && (
        <div className="composer-backdrop" onClick={() => setShowComposer(false)}>
          <form className="long-task-form composer-sheet" onSubmit={handleCreate} onClick={event => event.stopPropagation()}>
            <div className="long-form-title">
              <span className="material-symbols-outlined long-form-icon">emoji_events</span>
              <div>
                <p className="long-eyebrow">竞赛与项目</p>
                <h2>添加新条目</h2>
              </div>
            </div>

            <div className="long-field wide">
              <span>分类</span>
              <div className="long-category-picker">
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`long-cat-option ${draft.category === value ? 'active' : ''}`}
                    onClick={() => setDraft(prev => ({ ...prev, category: value }))}
                  >
                    <span className="material-symbols-outlined">{CATEGORY_ICONS[value]}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="long-field">
              <span>标题</span>
              <input
                value={draft.title}
                onChange={event => setDraft(prev => ({ ...prev, title: event.target.value }))}
                placeholder={draft.category === 'competition' ? '例如：数学建模、程序设计竞赛...' : '例如：毕业设计、课程大作业...'}
                maxLength={120}
                required
              />
            </label>

            <label className="long-field">
              <span>DDL</span>
              <input
                type="date"
                value={draft.dueDate}
                onChange={event => setDraft(prev => ({ ...prev, dueDate: event.target.value }))}
              />
            </label>

            <label className="long-field wide">
              <span>说明</span>
              <textarea
                value={draft.notes}
                onChange={event => setDraft(prev => ({ ...prev, notes: event.target.value }))}
                placeholder="写下背景、要求、参考链接、下一步..."
                rows={3}
                maxLength={2000}
              />
            </label>

            <button className="long-submit" type="submit" disabled={saving || !draft.title.trim()}>
              {saving ? '保存中...' : '添加'}
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
