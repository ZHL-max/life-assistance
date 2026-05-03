import webpush from 'web-push'

const VAPID_PUBLIC_KEY = 'BLlnNW1SYg4rav32C7L84uGpPoalidHREdkNKmofBekomHEBhT1O8ufSZhOvpUgGB37LStoYXECb3IcGncgGwIk'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'TYLtMvnhlI5h7qpGZSb-LytktahczihCU5nXi5nuID8'
const VAPID_SUBJECT = 'mailto:life-assistant@buaa.edu.cn'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY
}

export async function sendPushNotification(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return true
  } catch (error) {
    // 410 Gone = 订阅已过期，需要移除
    if (error.statusCode === 410 || error.statusCode === 404) {
      return 'expired'
    }
    console.error('Push send failed:', error.statusCode || error.message)
    return false
  }
}

function getTodayKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function startReminderScheduler(appData) {
  const CHECK_INTERVAL = 30 * 1000 // 30 秒检查一次
  const processedKeys = new Set() // 记录已处理的 reminderKey，避免重复发送

  // 每天零点清空已处理记录
  function maybeResetProcessed() {
    const today = getTodayKey()
    const key = `date:${today}`
    if (!processedKeys.has(key)) {
      // 新的一天，清空所有旧记录（包括 date: 和 reminder: 前缀）
      processedKeys.clear()
      processedKeys.add(key)
    }
  }

  async function checkAndSend() {
    maybeResetProcessed()
    const now = new Date()
    const today = getTodayKey()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    let users
    try {
      users = await appData.listUsers()
    } catch {
      return
    }

    for (const userId of users) {
      let reminders
      try {
        reminders = await appData.getReminders(userId)
      } catch {
        continue
      }

      const todayReminders = reminders[today]
      if (!todayReminders || todayReminders.length === 0) continue

      let subscriptions
      try {
        subscriptions = await appData.getPushSubscriptions(userId)
      } catch {
        continue
      }
      if (!subscriptions || subscriptions.length === 0) continue

      let changed = false

      for (const reminder of todayReminders) {
        if (!reminder.message || !reminder.time) continue
        if (reminder.sent) continue

        const reminderKey = `reminder:${today}:${reminder.id}`
        if (processedKeys.has(reminderKey)) continue

        const [hh, mm] = reminder.time.split(':').map(Number)
        const reminderMinutes = hh * 60 + mm

        // 提醒时间已到（允许 5 分钟的检查窗口，避免服务短暂中断导致漏发）
        if (reminderMinutes <= currentMinutes && currentMinutes - reminderMinutes < 5) {
          processedKeys.add(reminderKey)

          const payload = {
            title: '今日提醒',
            body: reminder.message,
            tag: `reminder-${reminder.id}`,
          }

          const expiredSubs = []
          for (const sub of subscriptions) {
            const result = await sendPushNotification(sub.subscription, payload)
            if (result === 'expired') {
              expiredSubs.push(sub.endpoint)
            }
          }

          // 标记已发送
          reminder.sent = true
          changed = true

          // 移除过期订阅
          if (expiredSubs.length > 0) {
            subscriptions = subscriptions.filter(s => !expiredSubs.includes(s.endpoint))
            await appData.savePushSubscriptions(userId, subscriptions)
          }
        }
      }

      if (changed) {
        await appData.saveReminders(userId, reminders)
      }
    }
  }

  // 立即检查一次，然后定时检查
  checkAndSend().catch(() => {})
  setInterval(() => checkAndSend().catch(() => {}), CHECK_INTERVAL)

  console.log('Push reminder scheduler started (checking every 30s)')
}
