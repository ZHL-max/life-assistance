import './BottomNav.css'

const NAV_ITEMS = [
  { key: 'home', label: '首页', icon: 'home' },
  { key: 'schedule', label: '课程', icon: 'school' },
  { key: 'calendar', label: '日历', icon: 'calendar_month' },
  { key: 'settings', label: '设置', icon: 'settings' },
]

export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="主导航">
      <div className="bottom-nav-inner">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            className={`nav-item ${activeTab === item.key ? 'active' : ''}`}
            onClick={() => onTabChange(item.key)}
            aria-label={item.label}
            aria-current={activeTab === item.key ? 'page' : undefined}
          >
            <div className="nav-icon-wrap">
              <span className="material-symbols-outlined nav-icon">{item.icon}</span>
              {activeTab === item.key && <div className="nav-pill" />}
            </div>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
