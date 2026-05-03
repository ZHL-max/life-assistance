import { API_BASE } from '../config'

export async function requestJson(url, options) {
  const response = await fetch(`${API_BASE}${url}`, options)
  const text = await response.text()
  let data = null

  try {
    data = JSON.parse(text)
  } catch {
    // non-JSON response
  }

  if (!response.ok) {
    throw new Error(data?.error ?? `请求失败：${response.status}`)
  }

  return data
}
