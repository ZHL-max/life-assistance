// API base URL — set VITE_API_BASE env var when deploying to Vercel
// pointing to your Railway backend URL (e.g. https://xxx.up.railway.app)
// In local dev this is empty (same-origin, Vite proxy handles it).
export const API_BASE = import.meta.env.VITE_API_BASE ?? ''
