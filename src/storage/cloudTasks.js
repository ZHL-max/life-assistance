import { requestJson } from './api'

export function fetchCloudTasks(userId) {
  return requestJson(`/api/app/tasks?userId=${encodeURIComponent(userId)}`)
}

export async function replaceCloudTasks(tasks, userId) {
  return requestJson(`/api/app/tasks?userId=${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks }),
  })
}
