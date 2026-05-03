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
  const [editingNickname, setEditingNickname] = useState(false)
  const [nicknameDraft, setNicknameDraft] = useState('')

  const handleThemeChange = (theme) => {
    setTheme(theme)
    setCurrentTheme(theme)
  }

  const startEditNickname = () => {
    setNicknameDraft(nickname)
    setEditingNickname(true)
  }

  const saveNickname = () => {
    const trimmed = nicknameDraft.trim()
    saveLocalNickname(userId, trimmed)
    onNicknameChange(trimmed)
    setNickname(trimmed)
    setEditingNickname(false)
  }

  const cancelEditNickname = () => {
    setEditingNickname(false)
    setNicknameDraft('')
  }

  const themes = [
    { value: 'light', label: '浅色', icon: 'light_mode' },
    { value: 'dark', label: '深色', icon: 'dark_mode' },
    { value: 'system', label: '跟随系统', icon: 'contrast' },
  ]

  return (
    <section className="settings-page">
      {/* Profile Header */}
      <div className="settings-profile">
        <div className="settings-avatar">
          <span className="material-symbols-outlined">person</span>
        </div>
        <div className="settings-profile-info">
          <strong>{nickname || '未设置昵称'}</strong>
          <span>{schoolId}</span>
        </div>
      </div>

      {/* Nickname Edit Modal */}
      {editingNickname && (
        <div className="settings-modal-backdrop" onClick={cancelEditNickname}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <h3>修改昵称</h3>
            <input
              className="settings-modal-input"
              value={nicknameDraft}
              onChange={e => setNicknameDraft(e.target.value)}
              placeholder="给自己取一个名字"
              maxLength={24}
              autoFocus
            />
            <div className="settings-modal-actions">
              <button className="settings-modal-btn cancel" onClick={cancelEditNickname}>取消</button>
              <button className="settings-modal-btn save" onClick={saveNickname}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Account Section */}
      <div className="settings-group">
        <p className="settings-group-title">账号</p>
        <div className="settings-list">
          <button className="settings-item" onClick={startEditNickname}>
            <span className="settings-item-icon material-symbols-outlined">badge</span>
            <span className="settings-item-label">昵称</span>
            <span className="settings-item-value">{nickname || '未设置'}</span>
            <span className="settings-item-arrow material-symbols-outlined">chevron_right</span>
          </button>
          <div className="settings-item">
            <span className="settings-item-icon material-symbols-outlined">school</span>
            <span className="settings-item-label">学号</span>
            <span className="settings-item-value">{schoolId}</span>
          </div>
        </div>
      </div>

      {/* Appearance Section */}
      <div className="settings-group">
        <p className="settings-group-title">外观</p>
        <div className="settings-list">
          {themes.map(t => (
            <button
              key={t.value}
              className={`settings-item ${currentTheme === t.value ? 'active' : ''}`}
              onClick={() => handleThemeChange(t.value)}
            >
              <span className="settings-item-icon material-symbols-outlined">{t.icon}</span>
              <span className="settings-item-label">{t.label}</span>
              {currentTheme === t.value && (
                <span className="settings-item-check material-symbols-outlined">check</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* About Section */}
      <div className="settings-group">
        <p className="settings-group-title">关于</p>
        <div className="settings-list">
          <div className="settings-item">
            <span className="settings-item-icon material-symbols-outlined">info</span>
            <span className="settings-item-label">版本</span>
            <span className="settings-item-value">1.0.0</span>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="settings-group">
        <div className="settings-list">
          <button className="settings-item danger" onClick={onSignOut}>
            <span className="settings-item-icon material-symbols-outlined">logout</span>
            <span className="settings-item-label">退出登录</span>
          </button>
        </div>
      </div>
    </section>
  )
}
