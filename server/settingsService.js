// Small persistent JSON key/value store for UI preferences that must survive an
// application restart (hotlist, extension -> command associations).
//
// Why this exists: the Electron window is served from `http://127.0.0.1:<random port>/`
// and `localStorage` is scoped per origin. Because the port changes on every launch,
// browser storage is effectively discarded on restart. These settings therefore live
// on the backend, next to the remote credential vault:
//
//   %APPDATA%/NukeFileManager/settings/<key>.json      (Windows default)
//   ~/Library/Application Support/... (see below)      (macOS/Linux: APPDATA unset -> home)
//
// `FM_SETTINGS_DIR` overrides the directory (used by tests / portable runs).
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Keys are internal identifiers ("hotlist", "associations"): keep them strictly
// alphanumeric so a request can never traverse outside the settings directory.
const KEY_PATTERN = /^[a-z0-9_-]{1,64}$/

function makeError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

/// Normalizes (lowercase/trim) and validates a settings key.
/// Throws `invalid_key` for anything that is not `[a-z0-9_-]{1,64}`.
export function sanitizeKey(key) {
  if (typeof key !== 'string') throw makeError('invalid_key', 'settings key required')
  const normalized = key.trim().toLowerCase()
  if (!KEY_PATTERN.test(normalized)) {
    throw makeError('invalid_key', `invalid settings key: ${key}`)
  }
  return normalized
}

function settingsDir() {
  if (process.env.FM_SETTINGS_DIR) return process.env.FM_SETTINGS_DIR
  return path.join(process.env.APPDATA || os.homedir(), 'NukeFileManager', 'settings')
}

function settingsPath(key) {
  return path.join(settingsDir(), `${key}.json`)
}

/// Reads a setting. Returns `null` when the file is missing, unreadable or holds
/// invalid JSON (a corrupt file must never break startup; the caller falls back
/// to the legacy localStorage value and re-writes it).
export async function getSetting(key) {
  const safe = sanitizeKey(key)
  try {
    const raw = await fs.readFile(settingsPath(safe), 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/// Writes a setting atomically (temp file in the same directory + rename) so a
/// crash mid-write cannot leave a truncated JSON file behind.
export async function setSetting(key, value) {
  const safe = sanitizeKey(key)
  const dir = settingsDir()
  await fs.mkdir(dir, { recursive: true })

  const target = settingsPath(safe)
  const temp = path.join(dir, `.${safe}.${process.pid}.${Date.now()}.tmp`)
  const payload = JSON.stringify(value === undefined ? null : value, null, 2)

  await fs.writeFile(temp, payload, 'utf8')
  try {
    await fs.rename(temp, target)
  } catch {
    // Some antivirus/indexer locks can make rename fail on Windows; fall back to
    // a direct write so the setting is still persisted, then clean the temp file.
    await fs.writeFile(target, payload, 'utf8')
    await fs.unlink(temp).catch(() => {})
  }
  return { ok: true }
}
