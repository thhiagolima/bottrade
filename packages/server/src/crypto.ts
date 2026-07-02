import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
if (!process.env.ENCRYPTION_KEY) {
  console.error('[CRYPTO] FATAL: ENCRYPTION_KEY environment variable is not set!')
  process.exit(1)
}
const ENCRYPTION_KEY: string = process.env.ENCRYPTION_KEY

function getKey(): Buffer {
  const salt = createHash('sha256').update(ENCRYPTION_KEY + '-salt').digest()
  return scryptSync(ENCRYPTION_KEY, salt, 32)
}

export function encrypt(text: string): string {
  if (!text) return ''
  const iv = randomBytes(16)
  const key = getKey()
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return ''
  const parts = encryptedText.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format — not in iv:authTag:encrypted format')
  }
  const [ivHex, authTagHex, encrypted] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const key = getKey()
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export function tryDecrypt(text: string): string {
  if (!text) return ''
  if (!isEncrypted(text)) return text // plaintext (legacy)
  return decrypt(text) // throws if key is wrong
}

export function maskSecret(value: string | undefined): string {
  if (!value) return ''
  if (value.length <= 8) return '****'
  return value.substring(0, 4) + '****' + value.substring(value.length - 4)
}

export function isEncrypted(text: string): boolean {
  if (!text) return false
  const parts = text.split(':')
  return parts.length === 3 && parts[0].length === 32 && parts[1].length === 32
}
