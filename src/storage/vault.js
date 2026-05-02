const VAULT_KEY_PREFIX = 'pika-password-vault-v1'
const PBKDF2_ITERATIONS = 120000

function getStorageKey(userId) {
  return `${VAULT_KEY_PREFIX}:${userId}`
}

function bytesToBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBytes(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes
}

async function deriveEncryptionKey(passphrase, saltBytes) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: saltBytes,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptVault(entries, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveEncryptionKey(passphrase, salt)
  const plainBytes = new TextEncoder().encode(JSON.stringify(entries))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plainBytes
  )

  return {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    updatedAt: Date.now(),
  }
}

async function decryptVault(payload, passphrase) {
  const salt = base64ToBytes(payload.salt)
  const iv = base64ToBytes(payload.iv)
  const ciphertext = base64ToBytes(payload.ciphertext)
  const key = await deriveEncryptionKey(passphrase, salt)
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  const text = new TextDecoder().decode(plainBuffer)
  const parsed = JSON.parse(text)

  if (!Array.isArray(parsed)) {
    throw new Error('密码库数据损坏，请重置后重试。')
  }

  return parsed
}

export function hasVault(userId) {
  return Boolean(localStorage.getItem(getStorageKey(userId)))
}

export async function initializeVault(userId, passphrase) {
  const payload = await encryptVault([], passphrase)
  localStorage.setItem(getStorageKey(userId), JSON.stringify(payload))
}

export async function unlockVault(userId, passphrase) {
  const raw = localStorage.getItem(getStorageKey(userId))

  if (!raw) {
    throw new Error('还没有创建密码库。')
  }

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error('密码库数据损坏，请重置后重试。')
  }

  if (!payload?.salt || !payload?.iv || !payload?.ciphertext) {
    throw new Error('密码库数据不完整，请重置后重试。')
  }

  try {
    return await decryptVault(payload, passphrase)
  } catch {
    throw new Error('主密码错误，或密码库无法解密。')
  }
}

export async function saveVaultEntries(userId, passphrase, entries) {
  const payload = await encryptVault(entries, passphrase)
  localStorage.setItem(getStorageKey(userId), JSON.stringify(payload))
}

export function clearVault(userId) {
  localStorage.removeItem(getStorageKey(userId))
}
