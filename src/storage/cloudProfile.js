import { requestJson } from './api'

export function fetchCloudProfile(userId) {
  return requestJson(`/api/app/profile?userId=${encodeURIComponent(userId)}`)
}

export function saveCloudProfile(userId, profile) {
  return requestJson(`/api/app/profile?userId=${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
}
