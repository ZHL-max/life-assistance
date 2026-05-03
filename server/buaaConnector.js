import fs from 'node:fs/promises'
import path from 'node:path'

const BUAA_BASE_URL = 'https://byxt.buaa.edu.cn'
const SSO_BASE_URL = 'https://sso.buaa.edu.cn'
const SSO_LOGIN_URL = `${SSO_BASE_URL}/login`
const SSO_CAPTCHA_URL = `${SSO_BASE_URL}/captcha`
const BUAA_CURRENT_USER_PATH = '/jwapp/sys/homeapp/api/home/currentUser.do'

class CookieJar {
  constructor(cookieHeader = '') {
    this.cookies = new Map()
    this.addCookieHeader(cookieHeader)
  }

  addCookieHeader(cookieHeader) {
    for (const part of String(cookieHeader ?? '').split(';')) {
      const [name, ...valueParts] = part.trim().split('=')
      const value = valueParts.join('=')
      if (name && value) this.cookies.set(name, value)
    }
  }

  addSetCookieHeaders(headers) {
    for (const header of headers) {
      const [cookiePair] = header.split(';')
      const [name, ...valueParts] = cookiePair.trim().split('=')
      const value = valueParts.join('=')
      if (name && value) this.cookies.set(name, value)
    }
  }

  header() {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
  }
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie()
  }

  const setCookie = response.headers.get('set-cookie')
  return setCookie ? [setCookie] : []
}

function absolutizeUrl(url, baseUrl) {
  return new URL(url, baseUrl).toString()
}

function decodeHtmlEntity(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function extractLoginForm(html) {
  const formMatch = html.match(/<form[^>]*id=["']?fm1["']?[^>]*>([\s\S]*?)<\/form>/i)
    ?? html.match(/<form[^>]*>([\s\S]*?)<\/form>/i)
  const formHtml = formMatch?.[0] ?? html
  const action = formHtml.match(/action=["']([^"']+)["']/i)?.[1] ?? SSO_LOGIN_URL
  const params = new URLSearchParams()
  const inputRegex = /<input\b[^>]*>/gi
  const inputs = formHtml.match(inputRegex) ?? []

  for (const input of inputs) {
    const name = input.match(/\bname=["']([^"']+)["']/i)?.[1]
    if (!name || name === 'username' || name === 'password') continue

    const type = input.match(/\btype=["']([^"']+)["']/i)?.[1]?.toLowerCase()
    if (['submit', 'button', 'image'].includes(type)) continue

    const value = decodeHtmlEntity(input.match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? '')
    params.set(name, value)
  }

  if (!params.has('_eventId')) params.set('_eventId', 'submit')
  if (!params.has('type')) params.set('type', 'username_password')
  if (!params.has('submit')) params.set('submit', '登录')

  return {
    actionUrl: absolutizeUrl(action, SSO_LOGIN_URL),
    params,
  }
}

function findLoginError(html) {
  const tip = html.match(/<div class=["']tip-text["']>([^<]+)<\/div>/i)?.[1]
  if (tip) return tip.trim()

  const error = html.match(/<div[^>]*id=["']errorDiv["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
  if (error) return error.replace(/<[^>]+>/g, '').trim()

  return null
}

function detectCaptcha(html) {
  const match = html.match(/config\.captcha\s*=\s*\{\s*type:\s*['"]([^'"]+)['"],\s*id:\s*['"]([^'"]+)['"]/i)
  if (match) {
    return {
      type: match[1],
      id: match[2],
      imageUrl: `${SSO_CAPTCHA_URL}?captchaId=${encodeURIComponent(match[2])}`,
    }
  }

  return null
}

function createClientId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isSessionExpiredMessage(message) {
  const text = String(message ?? '').toLowerCase()
  return text.includes('jwt expired')
    || text.includes('token expired')
    || text.includes('登录状态已失效')
    || text.includes('登录失效')
    || text.includes('请重新登录')
}

function shouldTreatAsSessionExpired(bodyText) {
  const text = String(bodyText ?? '').toLowerCase()
  return text.includes('sso.buaa.edu.cn')
    || text.includes('cas login')
    || text.includes('<html')
}

async function fetchWithJar(url, jar, options = {}) {
  let response
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    response = await fetch(url, {
      ...options,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/json,*/*',
        'User-Agent': 'Mozilla/5.0 Pika-Life-Assistant-Connector',
        Cookie: jar.header(),
        ...(options.headers ?? {}),
      },
    })
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`请求北航超时：${url}`)
    }
    throw new Error(`请求北航失败：${url}；${error.cause?.code ?? error.message}`)
  } finally {
    clearTimeout(timeout)
  }

  jar.addSetCookieHeaders(getSetCookieHeaders(response))
  return response
}

async function followRedirects(response, jar, maxRedirects = 12) {
  let current = response

  for (let index = 0; index < maxRedirects; index++) {
    if (current.status < 300 || current.status >= 400) return current

    const location = current.headers.get('location')
    if (!location) return current

    // Drain the previous response body to release the connection
    await current.text().catch(() => {})

    const nextUrl = absolutizeUrl(location, current.url)
    current = await fetchWithJar(nextUrl, jar)
  }

  throw new Error('SSO 重定向次数过多。')
}

async function loadByxtLoginPage(jar) {
  const firstResponse = await fetchWithJar(`${BUAA_BASE_URL}${BUAA_CURRENT_USER_PATH}`, jar, {
    headers: {
      Accept: 'application/json,text/html,*/*',
      'Fetch-Api': 'true',
      Referer: `${BUAA_BASE_URL}/jwapp/sys/homeapp/home/index.html?contextPath=/jwapp`,
    },
  })
  const loginPageResponse = await followRedirects(firstResponse, jar)
  const loginPageHtml = await loginPageResponse.text()

  return {
    response: loginPageResponse,
    html: loginPageHtml,
  }
}

export function createBuaaConnector({ dataDir }) {
  const usersDir = path.join(dataDir, 'users')
  const preLoginSessions = new Map()
  const PRELOGIN_TTL = 5 * 60 * 1000 // 5 minutes

  // Clean up expired preLogin sessions periodically
  setInterval(() => {
    const now = Date.now()
    for (const [key, session] of preLoginSessions) {
      if (now - session.createdAt > PRELOGIN_TTL) {
        preLoginSessions.delete(key)
      }
    }
  }, 60_000)

  function safeUserId(userId) {
    return String(userId ?? 'guest').replace(/[^\w.-]/g, '_')
  }

  function userSessionFile(userId) {
    return path.join(usersDir, safeUserId(userId), 'buaa-session.json')
  }

  async function rehydrateSessionFromCookie(cookie, userId) {
    const jar = new CookieJar(cookie)
    const homePageUrl = `${BUAA_BASE_URL}/jwapp/sys/homeapp/home/index.html?contextPath=/jwapp`

    const homeResponse = await fetchWithJar(homePageUrl, jar, {
      headers: {
        Accept: 'text/html,*/*',
        Referer: BUAA_BASE_URL,
      },
    })
    const homeRedirected = await followRedirects(homeResponse, jar)
    const homeHtml = await homeRedirected.text().catch(() => '')

    if (shouldTreatAsSessionExpired(homeHtml)) {
      return null
    }

    const appConfigUrl = `${BUAA_BASE_URL}/jwapp/sys/funauthapp/api/getAppConfig/homeapp-NHOL.do`
    const appConfigResponse = await fetchWithJar(appConfigUrl, jar, {
      method: 'GET',
      headers: {
        Accept: 'application/json,*/*',
        Referer: homePageUrl,
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    const appConfigRedirected = await followRedirects(appConfigResponse, jar)
    await appConfigRedirected.text().catch(() => {})

    const currentUserResponse = await fetchWithJar(`${BUAA_BASE_URL}${BUAA_CURRENT_USER_PATH}`, jar, {
      headers: {
        Accept: 'application/json,*/*',
        'Fetch-Api': 'true',
        Referer: homePageUrl,
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    const currentUserRedirected = await followRedirects(currentUserResponse, jar)
    const currentUserText = await currentUserRedirected.text().catch(() => '')

    let currentUser
    try {
      currentUser = JSON.parse(currentUserText)
    } catch {
      return null
    }

    if (currentUser?.code !== '0') {
      return null
    }

    await writeSession(jar.header(), userId)
    return jar.header()
  }

  async function readSession(userId) {
    try {
      const raw = await fs.readFile(userSessionFile(userId), 'utf8')
      const session = JSON.parse(raw)

      return typeof session.cookie === 'string' && session.cookie.trim()
        ? session
        : null
    } catch {
      return null
    }
  }

  async function writeSession(cookie, userId) {
    const dir = path.dirname(userSessionFile(userId))
    await fs.mkdir(dir, { recursive: true })

    const session = {
      cookie,
      savedAt: new Date().toISOString(),
    }

    await fs.writeFile(userSessionFile(userId), `${JSON.stringify(session, null, 2)}\n`, 'utf8')
    return session
  }

  async function clearSession(userId) {
    try {
      await fs.unlink(userSessionFile(userId))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  async function buaaFetch(pathname, { method = 'GET', body, userId } = {}) {
    const session = await readSession(userId)

    if (!session) {
      throw new Error('还没有保存北航登录 Cookie。')
    }

    let cookie = session.cookie

    for (let attempt = 0; attempt < 2; attempt++) {
      let response
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30_000)
      try {
        response = await fetch(`${BUAA_BASE_URL}${pathname}`, {
          method,
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'Content-Type': method === 'POST'
              ? 'application/x-www-form-urlencoded; charset=UTF-8'
              : 'application/json',
            Cookie: cookie,
            'Fetch-Api': 'true',
            Referer: `${BUAA_BASE_URL}/jwapp/sys/homeapp/home/index.html?contextPath=/jwapp`,
            'User-Agent': 'Mozilla/5.0 Pika-Life-Assistant-Connector',
          },
          body,
        })
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error(`请求北航教务超时：${pathname}`)
        }
        throw new Error(`请求北航教务失败：${pathname}；${error.cause?.code ?? error.message}`)
      } finally {
        clearTimeout(timeout)
      }

      if (!response.ok) {
        throw new Error(`北航接口返回 ${response.status}`)
      }

      const text = await response.text()
      let payload

      try {
        payload = JSON.parse(text)
      } catch {
        if (attempt === 0 && shouldTreatAsSessionExpired(text)) {
          const refreshedCookie = await rehydrateSessionFromCookie(cookie, userId).catch(() => null)
          if (refreshedCookie) {
            cookie = refreshedCookie
            continue
          }
        }
        await clearSession(userId)
        throw new Error('北航登录状态已失效，请重新登录。')
      }

      if (payload && Object.hasOwn(payload, 'code') && String(payload.code) !== '0') {
        const message = payload.msg || payload.message || `北航接口返回异常 code=${payload.code}`
        if (attempt === 0 && isSessionExpiredMessage(message)) {
          const refreshedCookie = await rehydrateSessionFromCookie(cookie, userId).catch(() => null)
          if (refreshedCookie) {
            cookie = refreshedCookie
            continue
          }
        }

        if (isSessionExpiredMessage(message)) {
          await clearSession(userId)
          throw new Error('北航登录状态已失效，请重新登录。')
        }

        throw new Error(message)
      }

      return payload
    }

    throw new Error('北航接口请求失败，请稍后重试。')
  }

  async function createPreLogin() {
    const jar = new CookieJar()
    const { html: loginPageHtml } = await loadByxtLoginPage(jar)
    const loginForm = extractLoginForm(loginPageHtml)
    const captcha = detectCaptcha(loginPageHtml)
    let captchaBase64 = null

    if (captcha?.imageUrl) {
      const captchaResponse = await fetchWithJar(captcha.imageUrl, jar, {
        headers: { Accept: 'image/*,*/*' },
      })
      const bytes = Buffer.from(await captchaResponse.arrayBuffer())
      const contentType = captchaResponse.headers.get('content-type') || 'image/jpeg'
      captchaBase64 = `data:${contentType};base64,${bytes.toString('base64')}`
    }

    const clientId = createClientId()
    preLoginSessions.set(clientId, {
      jar,
      loginForm,
      createdAt: Date.now(),
    })

    return {
      clientId,
      execution: loginForm.params.get('execution') ?? '',
      captchaRequired: Boolean(captcha),
      captcha: captcha
        ? {
            id: captcha.id,
            type: captcha.type,
            imageUrl: captcha.imageUrl,
            base64Image: captchaBase64,
          }
        : null,
    }
  }

  async function loginWithPassword({ username, password, captcha, clientId, userId }) {
    const nextUsername = String(username ?? '').trim()
    const nextPassword = String(password ?? '')

    if (!nextUsername || !nextPassword) {
      throw new Error('请填写学号和密码。')
    }

    let preLogin = clientId ? preLoginSessions.get(clientId) : null

    if (!preLogin) {
      const preload = await createPreLogin()
      preLogin = preLoginSessions.get(preload.clientId)
      preLoginSessions.delete(preload.clientId)
    }

    const jar = preLogin.jar
    const loginForm = preLogin.loginForm
    loginForm.params.set('username', nextUsername)
    loginForm.params.set('password', nextPassword)
    if (captcha) {
      loginForm.params.set('captcha', String(captcha))
      loginForm.params.set('captchaResponse', String(captcha))
    }

    const submitResponse = await fetchWithJar(loginForm.actionUrl, jar, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: SSO_LOGIN_URL,
      },
      body: loginForm.params,
    })
    if (clientId) preLoginSessions.delete(clientId)
    const finalLoginResponse = await followRedirects(submitResponse, jar)
    const finalBody = await finalLoginResponse.clone().text().catch(() => '')
    const loginError = findLoginError(finalBody)

    if (loginError || finalBody.includes('input name="execution"')) {
      throw new Error(loginError || '账号或密码错误。')
    }


    // WisEdu (金智) education systems require the application context to be
    // initialized before API calls work. Directly calling currentUser.do
    // after SSO login returns "系统异常" because the EMAP/WIS app framework
    // hasn't been set up yet.
    //
    // The correct flow is:
    // 1. Visit the homeapp index.html page (triggers SSO ticket exchange if needed)
    // 2. Call the funauthapp/getAppConfig endpoint to initialize the app context
    // 3. Then call currentUser.do which should return proper JSON

    // Step 1: Visit the homeapp HTML page to establish the portal session
    const homePageUrl = `${BUAA_BASE_URL}/jwapp/sys/homeapp/home/index.html?contextPath=/jwapp`
    const homeResponse = await fetchWithJar(homePageUrl, jar, {
      headers: {
        Accept: 'text/html,*/*',
        Referer: BUAA_BASE_URL,
      },
    })
    const homeRedirected = await followRedirects(homeResponse, jar)
    await homeRedirected.text().catch(() => {})

    // Step 2: Initialize the app context via funauthapp
    const appConfigUrl = `${BUAA_BASE_URL}/jwapp/sys/funauthapp/api/getAppConfig/homeapp-NHOL.do`
    const appConfigResponse = await fetchWithJar(appConfigUrl, jar, {
      method: 'GET',
      headers: {
        Accept: 'application/json,*/*',
        Referer: homePageUrl,
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    const appConfigRedirected = await followRedirects(appConfigResponse, jar)
    await appConfigRedirected.text().catch(() => {})

    // Step 3: Now call currentUser.do with the initialized session
    let currentUser = null
    for (let attempt = 0; attempt < 2; attempt++) {
      const portalFetchResponse = await fetchWithJar(`${BUAA_BASE_URL}${BUAA_CURRENT_USER_PATH}`, jar, {
        headers: {
          Accept: 'application/json,*/*',
          'Fetch-Api': 'true',
          Referer: homePageUrl,
          'X-Requested-With': 'XMLHttpRequest',
        },
      })
      const portalResponse = await followRedirects(portalFetchResponse, jar)
      const portalText = await portalResponse.text()

      try {
        currentUser = JSON.parse(portalText)
        break
      } catch {
        if (attempt === 1) {
          const isSSO = portalText.includes('sso.buaa.edu.cn') || portalText.includes('CAS Login')
          const hint = isSSO
            ? '教务系统仍然重定向到 SSO，可能需要二次验证或密码已变更。'
            : '教务系统返回了非 JSON 页面，可能需要验证码或服务暂时不可用。'
          throw new Error(`登录后未能进入北航教务：${hint}`)
        }
      }
    }

    if (currentUser?.code !== '0') {
      throw new Error(currentUser?.msg || '北航教务登录验证失败。')
    }

    await writeSession(jar.header(), userId)

    return {
      ok: true,
      user: currentUser.datas,
    }
  }

  return {
    async saveSession(cookie, userId) {
      const nextCookie = String(cookie ?? '').trim()

      if (!nextCookie || !nextCookie.includes('=')) {
        throw new Error('Cookie 格式不正确。')
      }

      await writeSession(nextCookie, userId)
      return { ok: true }
    },

    createPreLogin,

    loginWithPassword,

    async getStatus(userId) {
      const session = await readSession(userId)

      if (!session) {
        return { connected: false }
      }

      const currentUser = await buaaFetch(BUAA_CURRENT_USER_PATH, { userId })

      return {
        connected: currentUser?.code === '0',
        user: currentUser?.datas ?? null,
        savedAt: session.savedAt,
      }
    },

    async logout(userId) {
      await clearSession(userId)
      return { ok: true }
    },

    getTerms(userId) {
      return buaaFetch('/jwapp/sys/homeapp/api/home/student/schoolCalendars.do', { userId })
    },

    getWeeks(termCode, userId) {
      if (!termCode) {
        throw new Error('缺少 termCode。')
      }

      return buaaFetch(`/jwapp/sys/homeapp/api/home/getTermWeeks.do?termCode=${encodeURIComponent(termCode)}`, { userId })
    },

    getSchedule({ termCode, campusCode = '', type = 'class', week = '', userId }) {
      if (!termCode) {
        throw new Error('缺少 termCode。')
      }

      const params = new URLSearchParams({ termCode, campusCode, type })
      if (type === 'week' && week !== '') {
        params.set('week', String(week))
      }

      return buaaFetch('/jwapp/sys/homeapp/api/home/student/getMyScheduleDetail.do', {
        method: 'POST',
        body: params.toString(),
        userId,
      })
    },
  }
}
