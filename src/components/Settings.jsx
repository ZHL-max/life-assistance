import { useState } from 'react'
import { getLocalNickname, saveLocalNickname } from '../storage/nickname'
import { getTheme, setTheme } from '../storage/theme'
import './Settings.css'

export default function Settings({
  userEmail,
  userId,
  onNicknameChange,
  onSignOut,
}) {
  const schoolId = userEmail?.split('@')[0] ?? ''
  const [nickname, setNickname] = useState(() => getLocalNickname(userId))
  const [currentTheme, setCurrentTheme] = useState(() => getTheme())

  const handleSaveNickname = () => {
    try {
      saveLocalNickname(userId, nickname.trim())
      onNicknameChange(nickname.trim())
      window.alert('昵称已保存。')
    } catch {
      window.alert('保存失败，请稍后再试。')
    }
  }

  const handleThemeChange = (theme) => {
    setTheme(theme)
    setCurrentTheme(theme)
  }

  const themes = [
    { value: 'light', label: '浅色', icon: 'light_mode' },
    { value: 'dark', label: '深色', icon: 'dark_mode' },
    { value: 'system', label: '跟随系统', icon: 'contrast' },
  ]

  return (
    <section className="settings-page">
      <section className="settings-card">
        <h3>外观</h3>
        <div className="theme-options">
          {themes.map(t => (
            <button
              key={t.value}
              className={`theme-option ${currentTheme === t.value ? 'active' : ''}`}
              onClick={() => handleThemeChange(t.value)}
            >
              <span className="material-symbols-outlined">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <h3>账号</h3>
        <div className="setting-row">
          <span>当前登录</span>
          <strong>{schoolId}</strong>
        </div>
        <label className="setting-field">
          <span>显示昵称</span>
          <input
            value={nickname}
            onChange={event => setNickname(event.target.value)}
            placeholder="给自己取一个名字"
            maxLength={24}
          />
        </label>
        <button className="settings-button" onClick={handleSaveNickname}>
          保存昵称
        </button>
        <button className="settings-danger" onClick={onSignOut}>
          退出登录
        </button>
      </section>
    </section>
  )
}
