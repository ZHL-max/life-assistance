import './ProgressBar.css'

export default function ProgressBar({ total, done }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  const getMessage = () => {
    if (total === 0) return '今天还没有开始安排。'
    if (pct === 100) return '今天的任务已全部完成。'
    if (pct >= 75) return '快收尾了，继续保持。'
    if (pct >= 50) return '已经过半，节奏不错。'
    if (pct >= 25) return '正在推进中。'
    return '先完成第一项任务吧。'
  }

  return (
    <div className="progress-card glass-card">
      <div className="progress-header">
        <span className="progress-label">今日进度</span>
        <span className="progress-fraction">{done} / {total} 项</span>
      </div>

      <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
        <div
          className="progress-fill"
          style={{ width: `${pct}%` }}
        />
        <span className="progress-pct-badge" style={{ left: `max(${pct}%, 36px)` }}>
          {pct}%
        </span>
      </div>

      <div className="progress-message">{getMessage()}</div>
    </div>
  )
}
