import { requestJson } from './api'

export function fetchCloudReminders(userId) {
  return requestJson(`/api/app/reminders?userId=${encodeURIComponent(userId)}`)
}

export function replaceCloudReminders(reminders, userId) {
  return requestJson(`/api/app/reminders?userId=${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reminders }),
  })
}
