function getNicknameKey(userId) {
  return `life-assistant-nickname:${userId}`
}

export function getLocalNickname(userId) {
  try {
    return localStorage.getItem(getNicknameKey(userId)) || ''
  } catch {
    return ''
  }
}

export function saveLocalNickname(userId, nickname) {
  localStorage.setItem(getNicknameKey(userId), nickname)
}
