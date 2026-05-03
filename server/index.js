import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAppDataStore } from './appDataStore.js'
import { createBuaaConnector } from './buaaConnector.js'
import { getVapidPublicKey, startReminderScheduler } from './push.js'

const ROOT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DATA_DIR = path.join(ROOT_DIR, 'data')
const PORT = Number(process.env.PORT ?? process.env.CONNECTOR_PORT ?? 8787)
const connector = createBuaaConnector({ dataDir: DATA_DIR })
const appData = createAppDataStore({ dataDir: DATA_DIR })

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''

    req.on('data', chunk => {
      body += chunk

      if (body.length > 1_000_000) {
        reject(new Error('Request body is too large.'))
        req.destroy()
      }
    })

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (error) {
        reject(error)
      }
    })

    req.on('error', reject)
  })
}

async function handleBuaaRequest(req, res, url) {
  if (url.pathname === '/api/buaa/session' && req.method === 'POST') {
    const payload = await readJsonBody(req)
    sendJson(res, 200, await connector.saveSession(payload.cookie, payload.userId))
    return
  }

  if (url.pathname === '/api/buaa/login/preload' && req.method === 'POST') {
    sendJson(res, 200, await connector.createPreLogin())
    return
  }

  if (url.pathname === '/api/buaa/login' && req.method === 'POST') {
    const payload = await readJsonBody(req)
    const MAX_ATTEMPTS = 2
    let lastError = null

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        sendJson(res, 200, await connector.loginWithPassword(payload))
        return
      } catch (error) {
        lastError = error
        const msg = String(error?.message ?? '')
        const isPermanent = msg.includes('请填写学号和密码')
          || msg.includes('账号或密码错误')
          || msg.includes('验证码')
        if (isPermanent || attempt === MAX_ATTEMPTS - 1) break
        await new Promise(r => setTimeout(r, 1200))
      }
    }

    sendJson(res, 400, { error: lastError?.message || '登录失败，请重试。' })
    return
  }

  if (url.pathname === '/api/buaa/status' && req.method === 'GET') {
    const userId = url.searchParams.get('userId')
    sendJson(res, 200, await connector.getStatus(userId))
    return
  }

  if (url.pathname === '/api/buaa/logout' && req.method === 'POST') {
    const payload = await readJsonBody(req)
    sendJson(res, 200, await connector.logout(payload.userId))
    return
  }

  if (url.pathname === '/api/buaa/terms' && req.method === 'GET') {
    const userId = url.searchParams.get('userId')
    sendJson(res, 200, await connector.getTerms(userId))
    return
  }

  if (url.pathname === '/api/buaa/weeks' && req.method === 'GET') {
    const userId = url.searchParams.get('userId')
    sendJson(res, 200, await connector.getWeeks(url.searchParams.get('termCode'), userId))
    return
  }

  if (url.pathname === '/api/buaa/schedule' && req.method === 'POST') {
    const payload = await readJsonBody(req)
    sendJson(res, 200, await connector.getSchedule(payload))
    return
  }

  sendJson(res, 404, { error: '未知的北航 Connector 接口。' })
}

async function handleAppDataRequest(req, res, url) {
  const userId = url.searchParams.get('userId')

  if (!userId) {
    sendJson(res, 400, { error: '缺少 userId。' })
    return
  }

  if (url.pathname === '/api/app/tasks' && req.method === 'GET') {
    sendJson(res, 200, await appData.getTasks(userId))
    return
  }

  if (url.pathname === '/api/app/tasks' && req.method === 'PUT') {
    const payload = await readJsonBody(req)
    sendJson(res, 200, await appData.saveTasks(userId, payload.tasks))
    return
  }

  if (url.pathname === '/api/app/schedule' && req.method === 'GET') {
    sendJson(res, 200, await appData.getSchedule(userId))
    return
  }

  if (url.pathname === '/api/app/schedule' && req.method === 'PUT') {
    const payload = await readJsonBody(req)
    sendJson(res, 200, await appData.saveSchedule(userId, payload.events, payload.options))
    return
  }

  if (url.pathname === '/api/app/schedule/delete' && req.method === 'POST') {
    const payload = await readJsonBody(req)
    sendJson(res, 200, await appData.deleteScheduleEvent(userId, payload.eventId))
    return
  }

  if (url.pathname === '/api/app/long-tasks' && req.method === 'GET') {
    sendJson(res, 200, await appData.getLongTasks(userId))
    return
  }

  if (url.pathname === '/api/app/long-tasks' && req.method === 'POST') {
    const payload = await readJsonBody(req)
    sendJson(res, 200, await appData.createLongTask(userId, payload.task))
    return
  }

  if (url.pathname === '/api/app/long-tasks/update' && req.method === 'POST') {
    const payload = await readJsonBody(req)
    sendJson(res, 200, await appData.updateLongTask(userId, payload.taskId, payload.updates))
    return
  }

  if (url.pathname === '/api/app/long-tasks/delete' && req.method === 'POST') {
    const payload = await readJsonBody(req)
    sendJson(res, 200, await appData.deleteLongTask(userId, payload.taskId))
    return
  }

  if (url.pathname === '/api/app/long-tasks/files' && req.method === 'POST') {
    const payload = await readJsonBody(req)
    sendJson(res, 200, await appData.addLongTaskFile(userId, payload.taskId, payload.file))
    return
  }

  if (url.pathname === '/api/app/long-tasks/files/delete' && req.method === 'POST') {
    const payload = await readJsonBody(req)
    sendJson(res, 200, await appData.deleteLongTaskFile(userId, payload.taskId, payload.fileId))
    return
  }

  if (url.pathname === '/api/app/reminders' && req.method === 'GET') {
    sendJson(res, 200, await appData.getReminders(userId))
    return
  }

  if (url.pathname === '/api/app/reminders' && req.method === 'PUT') {
    const payload = await readJsonBody(req)
    sendJson(res, 200, await appData.saveReminders(userId, payload.reminders))
    return
  }

  if (url.pathname === '/api/app/push/subscribe' && req.method === 'POST') {
    const payload = await readJsonBody(req)
    const subs = await appData.getPushSubscriptions(userId)
    const endpoint = payload.subscription?.endpoint
    if (endpoint && !subs.some(s => s.endpoint === endpoint)) {
      subs.push({ endpoint, subscription: payload.subscription, createdAt: Date.now() })
      await appData.savePushSubscriptions(userId, subs)
    }
    sendJson(res, 200, { ok: true })
    return
  }

  if (url.pathname === '/api/app/push/unsubscribe' && req.method === 'POST') {
    const payload = await readJsonBody(req)
    const subs = await appData.getPushSubscriptions(userId)
    const next = subs.filter(s => s.endpoint !== payload.endpoint)
    await appData.savePushSubscriptions(userId, next)
    sendJson(res, 200, { ok: true })
    return
  }

  if (url.pathname === '/api/app/profile' && req.method === 'GET') {
    sendJson(res, 200, await appData.getProfile(userId))
    return
  }

  if (url.pathname === '/api/app/profile' && req.method === 'PUT') {
    const payload = await readJsonBody(req)
    sendJson(res, 200, await appData.saveProfile(userId, payload))
    return
  }

  sendJson(res, 404, { error: '未知的 App 数据接口。' })
}

const server = http.createServer(async (req, res) => {
  setCors(res)

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)

  try {
    if (url.pathname === '/health') {
      sendJson(res, 200, { ok: true, service: 'pika-buaa-connector' })
      return
    }

    if (url.pathname === '/api/app/push/vapid-public-key' && req.method === 'GET') {
      sendJson(res, 200, { publicKey: getVapidPublicKey() })
      return
    }

    if (url.pathname.startsWith('/api/buaa/')) {
      await handleBuaaRequest(req, res, url)
      return
    }

    if (url.pathname.startsWith('/api/app/')) {
      await handleAppDataRequest(req, res, url)
      return
    }

    sendJson(res, 404, { error: 'Not found.' })
  } catch (error) {
    sendJson(res, 500, { error: error.message })
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Pika BUAA Connector listening on http://127.0.0.1:${PORT}`)
  startReminderScheduler(appData)
})
