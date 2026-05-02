import { useState } from 'react'
import {
  clearVault,
  hasVault,
  initializeVault,
  saveVaultEntries,
  unlockVault,
} from '../storage/vault'
import './Vault.css'

function createEmptyDraft() {
  return {
    appName: '',
    account: '',
    password: '',
    memo: '',
  }
}

export default function Vault({ userId }) {
  const [message, setMessage] = useState('')
  const [masterPassword, setMasterPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [sessionPassphrase, setSessionPassphrase] = useState('')
  const [entries, setEntries] = useState([])
  const [draft, setDraft] = useState(createEmptyDraft())
  const [saving, setSaving] = useState(false)
  const [revealedId, setRevealedId] = useState(null)
  const [initialized, setInitialized] = useState(() => hasVault(userId))

  const persistEntries = async (nextEntries, passphrase) => {
    await saveVaultEntries(userId, passphrase, nextEntries)
    setEntries(nextEntries)
  }

  const handleCreateVault = async (event) => {
    event.preventDefault()
    if (saving) return

    const pwd = masterPassword.trim()
    const confirm = confirmPassword.trim()

    if (pwd.length < 6) {
      setMessage('主密码至少需要 6 位。')
      return
    }

    if (pwd !== confirm) {
      setMessage('两次输入的主密码不一致。')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      await initializeVault(userId, pwd)
      setSessionPassphrase(pwd)
      setUnlocked(true)
      setInitialized(true)
      setEntries([])
      setMasterPassword('')
      setConfirmPassword('')
      setMessage('密码库已创建。')
    } catch (error) {
      setMessage(`创建失败：${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleUnlock = async (event) => {
    event.preventDefault()
    if (saving) return

    const pwd = unlockPassword.trim()
    if (!pwd) {
      setMessage('请输入主密码。')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const loaded = await unlockVault(userId, pwd)
      setEntries(loaded)
      setSessionPassphrase(pwd)
      setUnlocked(true)
      setUnlockPassword('')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = async (event) => {
    event.preventDefault()
    if (saving) return

    const appName = draft.appName.trim()
    if (!appName || !draft.account.trim() || !draft.password.trim()) {
      setMessage('请填写平台、账号和密码。')
      return
    }

    setSaving(true)
    setMessage('')

    const nextEntries = [
      {
        id: crypto.randomUUID(),
        appName,
        account: draft.account.trim(),
        password: draft.password,
        memo: draft.memo.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      ...entries,
    ]

    try {
      await persistEntries(nextEntries, sessionPassphrase)
      setDraft(createEmptyDraft())
      setMessage('已新增一条密码记录。')
    } catch (error) {
      setMessage(`保存失败：${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const confirmed = window.confirm('删除后无法恢复，确认删除吗？')
    if (!confirmed || saving) return

    setSaving(true)
    setMessage('')

    const nextEntries = entries.filter(entry => entry.id !== id)

    try {
      await persistEntries(nextEntries, sessionPassphrase)
      if (revealedId === id) setRevealedId(null)
    } catch (error) {
      setMessage(`删除失败：${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (id, field, value) => {
    const nextEntries = entries.map(entry => (
      entry.id === id
        ? { ...entry, [field]: value, updatedAt: Date.now() }
        : entry
    ))

    setEntries(nextEntries)

    try {
      await persistEntries(nextEntries, sessionPassphrase)
    } catch (error) {
      setMessage(`更新失败：${error.message}`)
    }
  }

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      setMessage(`${label}已复制到剪贴板。`)
    } catch {
      setMessage(`复制${label}失败，请手动复制。`)
    }
  }

  const handleResetVault = () => {
    const confirmed = window.confirm('这会清空全部密码记录，且无法恢复，确认重置？')
    if (!confirmed) return

    clearVault(userId)
    setUnlocked(false)
    setInitialized(false)
    setEntries([])
    setSessionPassphrase('')
    setRevealedId(null)
    setMessage('密码库已重置，请重新创建主密码。')
  }

  const lockVault = () => {
    setUnlocked(false)
    setEntries([])
    setSessionPassphrase('')
    setRevealedId(null)
    setMessage('已锁定密码库。')
  }

  return (
    <section className="vault-page">
      <div className="vault-hero">
        <span className="vault-icon">🔐</span>
        <div>
          <p className="vault-eyebrow">Memo Vault</p>
          <h2>备忘录与密码库</h2>
          <p>本页面仅保存在当前设备。建议设置一个容易记住但不常见的主密码。</p>
        </div>
      </div>

      {!unlocked && !initialized && (
        <form className="vault-card" onSubmit={handleCreateVault}>
          <h3>创建密码库</h3>
          <p className="vault-copy">首次使用请设置主密码，用于加密保存账号与密码记录。</p>
          <label className="vault-field">
            <span>主密码</span>
            <input
              type="password"
              value={masterPassword}
              onChange={event => setMasterPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="vault-field">
            <span>确认主密码</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <button className="vault-btn" type="submit" disabled={saving}>创建并进入</button>
        </form>
      )}

      {!unlocked && initialized && (
        <form className="vault-card" onSubmit={handleUnlock}>
          <h3>解锁密码库</h3>
          <p className="vault-copy">输入主密码即可查看你保存的账号、密码和备忘录。</p>
          <label className="vault-field">
            <span>主密码</span>
            <input
              type="password"
              value={unlockPassword}
              onChange={event => setUnlockPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <div className="vault-row">
            <button className="vault-btn" type="submit" disabled={saving}>解锁</button>
            <button className="vault-ghost" type="button" onClick={handleResetVault}>重置密码库</button>
          </div>
        </form>
      )}

      {unlocked && (
        <>
          <form className="vault-card" onSubmit={handleAdd}>
            <div className="vault-title-row">
              <h3>新增记录</h3>
              <button className="vault-ghost" type="button" onClick={lockVault}>锁定</button>
            </div>

            <label className="vault-field">
              <span>平台 / 应用</span>
              <input
                value={draft.appName}
                onChange={event => setDraft(prev => ({ ...prev, appName: event.target.value }))}
                placeholder="例如：QQ 邮箱、智慧树、GitHub"
                maxLength={80}
                required
              />
            </label>

            <div className="vault-grid">
              <label className="vault-field">
                <span>账号</span>
                <input
                  value={draft.account}
                  onChange={event => setDraft(prev => ({ ...prev, account: event.target.value }))}
                  placeholder="手机号 / 邮箱 / 用户名"
                  maxLength={120}
                  required
                />
              </label>

              <label className="vault-field">
                <span>密码</span>
                <input
                  type="password"
                  value={draft.password}
                  onChange={event => setDraft(prev => ({ ...prev, password: event.target.value }))}
                  placeholder="输入密码"
                  maxLength={200}
                  required
                />
              </label>
            </div>

            <label className="vault-field">
              <span>备忘录</span>
              <textarea
                value={draft.memo}
                onChange={event => setDraft(prev => ({ ...prev, memo: event.target.value }))}
                placeholder="可记录验证码方式、常见问题、绑定手机号等"
                rows={3}
                maxLength={2000}
              />
            </label>

            <button className="vault-btn" type="submit" disabled={saving}>保存记录</button>
          </form>

          <div className="vault-list">
            {entries.length === 0 && (
              <p className="vault-empty">还没有记录，先添加你的第一个账号密码。</p>
            )}

            {entries.map(entry => {
              const show = revealedId === entry.id

              return (
                <article key={entry.id} className="vault-item">
                  <div className="vault-item-head">
                    <input
                      className="vault-item-title"
                      value={entry.appName}
                      onChange={event => handleUpdate(entry.id, 'appName', event.target.value)}
                      maxLength={80}
                    />
                    <button className="vault-danger" type="button" onClick={() => handleDelete(entry.id)}>删除</button>
                  </div>

                  <div className="vault-grid compact">
                    <label className="vault-field compact">
                      <span>账号</span>
                      <div className="vault-inline">
                        <input
                          value={entry.account}
                          onChange={event => handleUpdate(entry.id, 'account', event.target.value)}
                          maxLength={120}
                        />
                        <button type="button" className="vault-copy-btn" onClick={() => handleCopy(entry.account, '账号')}>复制</button>
                      </div>
                    </label>

                    <label className="vault-field compact">
                      <span>密码</span>
                      <div className="vault-inline">
                        <input
                          type={show ? 'text' : 'password'}
                          value={entry.password}
                          onChange={event => handleUpdate(entry.id, 'password', event.target.value)}
                          maxLength={200}
                        />
                        <button type="button" className="vault-copy-btn" onClick={() => setRevealedId(show ? null : entry.id)}>
                          {show ? '隐藏' : '查看'}
                        </button>
                        <button type="button" className="vault-copy-btn" onClick={() => handleCopy(entry.password, '密码')}>复制</button>
                      </div>
                    </label>
                  </div>

                  <label className="vault-field compact">
                    <span>备忘录</span>
                    <textarea
                      value={entry.memo}
                      onChange={event => handleUpdate(entry.id, 'memo', event.target.value)}
                      rows={3}
                      maxLength={2000}
                    />
                  </label>
                </article>
              )
            })}
          </div>
        </>
      )}

      {message && <p className="vault-message">{message}</p>}
    </section>
  )
}
