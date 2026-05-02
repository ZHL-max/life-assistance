# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**生活助手 (Life Assistant)** — A React + Vite PWA for Beihang University (BUAA) students. Provides daily tasks, long-term goals, course schedule synced from BUAA教务系统, and an encrypted local password vault. Auth is via BUAA SSO (no standard OAuth/email-password).

## Commands

- `npm run dev` — Start Vite dev server on port 5173
- `npm run connector` — Start backend server on port 8787 (BUAA SSO + data API)
- `npm run dev:all` — Start both dev server and connector concurrently
- `npm run build` — Production build via Vite
- `npm run lint` — Run ESLint across the project
- `npm run preview` — Preview production build

## Architecture

### Frontend (`src/`)

- **`App.jsx`** — Root component. Tab-based navigation (`home`, `daily`, `calendar`, `long`, `schedule`, `vault`, `settings`). Manages daily task state in memory with cloud sync.
- **`AuthGate.jsx`** — Authentication gate. Uses BUAA SSO (学号+密码+验证码). No email/password auth — the entire app requires a BUAA account.
- **Components** — Each tab maps to a component: `Dashboard` (home hub), `Calendar` (month view with tasks+courses), `Schedule` (weekly course grid from BUAA), `LongTasks` (goals with file uploads), `Vault` (AES-GCM encrypted password manager), `Settings` (nickname, logout).
- **Storage (`src/storage/`)** — API wrappers that fetch from the backend (`/api/app/tasks`, `/api/app/schedule`, `/api/app/long-tasks`). `tasks.js` also provides localStorage fallback and daily-repeat logic. `vault.js` does client-side encryption with `crypto.subtle` (AES-GCM 256 + PBKDF2). `nickname.js` is plain localStorage.
- **Utility (`src/utils/courseImport.js`)** — Parses BUAA API responses and XLSX schedule exports into calendar events. Multiple parse functions handle different BUAA API formats.

### Backend (`server/`)

- **`index.js`** — Raw `node:http` server on port 8787. Two route groups:
  - `/api/buaa/*` — BUAA SSO connector (login, session, course terms/weeks/schedule)
  - `/api/app/*` — App data CRUD (tasks, schedule, long-tasks with file uploads as data URLs)
- **`buaaConnector.js`** — SSO integration. Maintains a CookieJar, follows redirects, handles CAS login flow, captcha, and automatic session refresh via EMAP/WIS app context initialization. Stores session to `data/buaa-session.json`.
- **`appDataStore.js`** — File-based JSON storage per user at `data/users/{userId}/{tasks,schedule,long-tasks}.json`.

### Vite Config (`vite.config.js`)

- Inlines a middleware for `/api/tasks` (shared local task storage at `data/tasks.json`) for both dev and preview servers.
- Proxies `/api/buaa` and `/api/app` to the connector server at `127.0.0.1:8787`.

### Data Flow

1. User logs in via BUAA SSO → `AuthGate` calls `/api/buaa/login` → server validates against `sso.buaa.edu.cn` → session cookie saved to `data/buaa-session.json`
2. Daily tasks: fetched from `/api/app/tasks` on mount, saved on every change via `replaceCloudTasks`. LocalStorage fallback if cloud unavailable.
3. Schedule: user selects a term → server fetches term weeks from BUAA API → user navigates weeks → each week's courses fetched and stored server-side
4. Long tasks: CRUD via `/api/app/long-tasks`. File attachments stored as data URLs in JSON.
5. Vault: purely client-side. Entries encrypted with AES-GCM 256, stored in localStorage, never sent to server.
