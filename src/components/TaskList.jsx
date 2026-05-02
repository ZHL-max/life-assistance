import TaskItem from './TaskItem'
import './TaskList.css'

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (a.pinned && b.pinned) return (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0)

    return (a.createdAt ?? 0) - (b.createdAt ?? 0)
  })
}

export default function TaskList({ tasks, onToggle, onDelete, onEdit, onPin, onStopRepeat }) {
  if (tasks.length === 0) return null

  const active = sortTasks(tasks.filter(t => !t.done))
  const done = sortTasks(tasks.filter(t => t.done))

  return (
    <div className="task-list-container">
      {active.length > 0 && (
        <section className="task-section">
          <div className="section-label">
            <span className="section-dot dot-active" />
            待完成
            <span className="section-count">{active.length}</span>
          </div>
          <ul className="task-list">
            {active.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={onEdit}
                onPin={onPin}
                onStopRepeat={onStopRepeat}
              />
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section className="task-section">
          <div className="section-label">
            <span className="section-dot dot-done" />
            已完成
            <span className="section-count">{done.length}</span>
          </div>
          <ul className="task-list">
            {done.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={onEdit}
                onPin={onPin}
                onStopRepeat={onStopRepeat}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
