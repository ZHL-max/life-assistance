import { requestJson } from './api'

export function fetchScheduleEvents(userId) {
  return requestJson(`/api/app/schedule?userId=${encodeURIComponent(userId)}`)
}

export function importScheduleEvents(userId, events, options = {}) {
  return requestJson(`/api/app/schedule?userId=${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events, options }),
  })
}

export function deleteScheduleEvent(userId, eventId) {
  return requestJson(`/api/app/schedule/delete?userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId }),
  })
}
