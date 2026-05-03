import { API_BASE } from '../config'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const array = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    array[i] = raw.charCodeAt(i)
  }
  return array
}

export async function getVapidPublicKey() {
  const res = await fetch(`${API_BASE}/api/app/push/vapid-public-key`)
  const data = await res.json()
  return data.publicKey
}

export async function registerPushSubscription(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('此浏览器不支持推送通知')
  }

  // 请求通知权限
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('通知权限未开启，请在浏览器设置中允许通知')
  }

  // 等待 Service Worker 就绪
  const registration = await navigator.serviceWorker.ready

  // 检查是否已有订阅
  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    // 获取 VAPID 公钥并订阅
    const vapidKey = await getVapidPublicKey()
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }

  // 保存订阅到服务器
  await fetch(`${API_BASE}/api/app/push/subscribe?userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  })

  return subscription
}

export async function checkPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false
  }
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return !!subscription
}
