/**
 * Small HTTP helpers for the host routes: coded errors, bounded JSON reads, and
 * JSON responses. Kept separate from the data sources so each fetch failure
 * maps to exactly one stable code the browser half can localize.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/host/http
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DataErrorCode } from '../shared.js'

/** A failure with a stable code the browser half can explain. */
export class DataError extends Error {
  readonly code: DataErrorCode
  readonly status: number | undefined

  /**
   * @param code - stable error code.
   * @param message - developer-facing text; never includes a secret.
   * @param status - optional upstream HTTP status.
   */
  constructor(code: DataErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'DataError'
    this.code = code
    this.status = status
  }
}

/** Map any thrown value to a stable code. */
export function errorCode(error: unknown): DataErrorCode {
  return error instanceof DataError ? error.code : 'fetch_failed'
}

/** Write one JSON response with no caching. */
export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

/** Reject a route call with the method guard's 405 body. */
export function methodNotAllowed(res: ServerResponse): void {
  sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
}

/**
 * Read a bounded JSON request body.
 * @param req - incoming request.
 * @param limitBytes - maximum accepted body size.
 * @returns the parsed object, or undefined when the body is absent/oversized/invalid.
 */
export async function readJsonBody(
  req: IncomingMessage,
  limitBytes = 16 * 1024,
): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.byteLength
    if (size > limitBytes) return undefined
    chunks.push(buffer)
  }
  if (size === 0) return undefined
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Read a response body as text with a hard byte cap, so a hostile or broken
 * upstream cannot exhaust memory.
 * @param response - fetch response.
 * @param maxBytes - maximum accepted body size.
 * @returns the decoded UTF-8 body.
 * @throws DataError `invalid_response` when the cap is exceeded.
 */
export async function readTextLimited(response: Response, maxBytes = 512 * 1024): Promise<string> {
  const reader = response.body?.getReader()
  if (reader === undefined) {
    const text = await response.text()
    if (Buffer.byteLength(text) > maxBytes) throw new DataError('invalid_response', 'response too large')
    return text
  }
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new DataError('invalid_response', 'response too large')
      }
      chunks.push(part.value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8')
}
