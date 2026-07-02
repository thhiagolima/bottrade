import { describe, it, expect, vi } from 'vitest'

// Set required env vars before importing modules that check them at load time
vi.hoisted(() => {
  process.env.ENCRYPTION_KEY = 'bottrade-dev-encryption-key-32ch'
})

import { encrypt, decrypt, maskSecret, isEncrypted } from '../crypto.js'

describe('crypto', () => {
  it('encrypts and decrypts roundtrip', () => {
    const original = 'my-secret-api-key-12345'
    const encrypted = encrypt(original)
    expect(encrypted).not.toBe(original)
    expect(decrypt(encrypted)).toBe(original)
  })

  it('encrypt returns empty string for empty input', () => {
    expect(encrypt('')).toBe('')
  })

  it('decrypt returns empty string for empty input', () => {
    expect(decrypt('')).toBe('')
  })

  it('decrypt throws on invalid encrypted data', () => {
    expect(() => decrypt('bad:data:here')).toThrow()
  })

  it('decrypt throws on corrupted ciphertext', () => {
    const encrypted = encrypt('test')
    const corrupted = encrypted.slice(0, -4) + 'ZZZZ'
    expect(() => decrypt(corrupted)).toThrow()
  })

  it('isEncrypted detects encrypted format', () => {
    const encrypted = encrypt('test')
    expect(isEncrypted(encrypted)).toBe(true)
    expect(isEncrypted('plaintext')).toBe(false)
    expect(isEncrypted('')).toBe(false)
  })

  it('maskSecret masks correctly', () => {
    expect(maskSecret('1234567890abcdef')).toBe('1234****cdef')
    expect(maskSecret('short')).toBe('****')
    expect(maskSecret(undefined)).toBe('')
  })
})
