import { API_BASE } from '../config'

async function requestJson(url, options) {
  const response = await fetch(`${API_BASE}${url}`, options)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error ?? `请求失败：${response.status}`)
  }

  return data
}

export function saveBuaaCookie(cookie) {
  return requestJson('/api/buaa/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cookie }),
  })
}

export function preloadBuaaLogin() {
  return requestJson('/api/buaa/login/preload', { method: 'POST' })
}

export function loginBuaa(username, password, options = {}) {
  return requestJson('/api/buaa/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password,
      captcha: options.captcha,
      clientId: options.clientId,
      userId: options.userId,
    }),
  })
}

export function getBuaaStatus(userId) {
  return requestJson(`/api/buaa/status?userId=${encodeURIComponent(userId)}`)
}

export function logoutBuaa(userId) {
  return requestJson('/api/buaa/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
}

export function reloginBuaa(userId) {
  return requestJson('/api/buaa/relogin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
}

export function getBuaaTerms(userId) {
  return requestJson(`/api/buaa/terms?userId=${encodeURIComponent(userId)}`)
}

export function getBuaaWeeks(termCode, userId) {
  return requestJson(`/api/buaa/weeks?termCode=${encodeURIComponent(termCode)}&userId=${encodeURIComponent(userId)}`)
}

export function getBuaaSchedule(termCode, options = {}) {
  const type = options.type ?? 'class'
  const body = {
    termCode,
    campusCode: options.campusCode ?? '',
    type,
    userId: options.userId,
  }

  if (type === 'week' && options.week !== undefined) {
    body.week = options.week
  }

  return requestJson('/api/buaa/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function getBuaaWeeklySchedule(termCode, week, userId) {
  return getBuaaSchedule(termCode, { type: 'week', week, userId })
}
