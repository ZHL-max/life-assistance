// API base URL — set VITE_API_BASE env var when deploying to Vercel.
// In local dev this is empty (same-origin, Vite proxy handles it).
// In production, defaults to Railway backend if env var is not set.
export const API_BASE = import.meta.env.VITE_API_BASE
  ?? (import.meta.env.DEV ? '' : 'https://life-assistance-production.up.railway.app')
