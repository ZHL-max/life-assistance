import { requestJson } from './api'

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function fetchLongTasks(userId) {
  return requestJson(`/api/app/long-tasks?userId=${encodeURIComponent(userId)}`)
}

export function createLongTask(userId, task) {
  return requestJson(`/api/app/long-tasks?userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task }),
  })
}

export function updateLongTask(userId, taskId, updates) {
  return requestJson(`/api/app/long-tasks/update?userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, updates }),
  })
}

export function deleteLongTask(userId, taskId) {
  return requestJson(`/api/app/long-tasks/delete?userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId }),
  })
}

export async function uploadLongTaskFile(userId, taskId, file) {
  const dataUrl = await fileToDataUrl(file)
  return requestJson(`/api/app/long-tasks/files?userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId,
      file: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || null,
        dataUrl,
      },
    }),
  })
}

export function openLongTaskFile(file) {
  const dataUrl = file?.dataUrl
  if (!dataUrl) throw new Error('文件内容不存在。')
  window.open(dataUrl, '_blank', 'noopener,noreferrer')
}

export function deleteLongTaskFile(userId, taskId, fileId) {
  return requestJson(`/api/app/long-tasks/files/delete?userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, fileId }),
  })
}
