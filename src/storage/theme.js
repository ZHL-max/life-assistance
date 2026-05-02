const STORAGE_KEY = 'pika-theme'

export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'light'
}

export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  document.documentElement.dataset.theme = theme
}

export function applyTheme() {
  const saved = getTheme()
  if (saved === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light'
  } else {
    document.documentElement.dataset.theme = saved
  }
}
