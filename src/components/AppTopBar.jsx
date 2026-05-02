import './AppTopBar.css'

const TITLES = {
  home: '生活助手',
  daily: '今日任务',
  long: '长期目标',
  schedule: '课程表',
  calendar: '日历',
  vault: '密码库',
  settings: '设置',
}

const ROOT_TABS = new Set(['home', 'schedule', 'calendar', 'settings'])

export default function AppTopBar({ activeTab, onBack, onSettings }) {
  const canGoBack = !ROOT_TABS.has(activeTab)

  return (
    <header className="app-topbar">
      <button
        className={`topbar-icon-btn ${canGoBack ? '' : 'hidden'}`}
        onClick={onBack}
        aria-label="返回"
        type="button"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </button>

      <h1>{TITLES[activeTab] ?? '生活助手'}</h1>

      <button
        className="topbar-icon-btn"
        onClick={onSettings}
        aria-label="设置"
        type="button"
      >
        <span className="material-symbols-outlined">settings</span>
      </button>
    </header>
  )
}
