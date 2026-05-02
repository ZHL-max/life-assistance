import './HomeHero.css'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const MONTHS = ['1','2','3','4','5','6','7','8','9','10','11','12']

function getGreeting() {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return '早上好'
  if (h >= 12 && h < 18) return '下午好'
  if (h >= 18 && h < 22) return '晚上好'
  return '深夜了'
}

export default function HomeHero({ total, doneCount, userName }) {
  const now = new Date()
  const pending = total - doneCount

  return (
    <section className="home-hero">
      <div className="home-brand">
        <img className="home-mascot" src="/pika-icon.svg" alt="" aria-hidden="true" />
        <span>日常生活助手</span>
      </div>
      <p className="home-date">
        今天 · {MONTHS[now.getMonth()]}月{now.getDate()}日 {WEEKDAYS[now.getDay()]}
      </p>
      <h2>{getGreeting()}，<span>{userName || '同学'}</span></h2>
      <p className="home-desc">
        {total === 0
          ? '今天还没有任务，可以从一个小目标开始。'
          : pending === 0
          ? `全部 ${total} 项任务已完成，今天的节奏很好。`
          : `你有 ${pending} 个任务待处理，保持节奏，稳稳完成。`}
      </p>
    </section>
  )
}
