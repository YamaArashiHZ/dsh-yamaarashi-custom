/**
 * Loopback + same-origin request guard shared by every route.
 *
 * The harness web server is bound to a loopback address, but a hostile page in
 * the same browser could still fire cross-site requests at it (DNS rebinding,
 * form posts). Routes that read credentials therefore accept only loopback
 * sockets whose `Host` names this machine and whose `Sec-Fetch-Site` is not
 * `cross-site`; mutating routes additionally require an `Origin` that matches
 * the request host (same-origin browsers send it on PUT/DELETE).
 *
 * This is not authentication against other local processes — it is the same
 * boundary DSH's own APIs use for local, credential-backed helpers.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/host/guard
 */

import type { IncomingMessage } from 'node:http'

/** Socket addresses that mean "this machine" in Node's address forms. */
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/** Host names a loopback-bound server can legitimately be addressed by. */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])

/**
 * Accept one request only when it originates from this machine and, for
 * mutating methods, from this origin.
 * @param req - incoming request.
 * @param requireOrigin - true for PUT/DELETE, where a browser always sends `Origin`.
 * @returns true when the route may proceed.
 */
export function isTrustedRequest(req: IncomingMessage, requireOrigin = false): boolean {
  const address = req.socket?.remoteAddress
  if (address === undefined || !LOOPBACK_ADDRESSES.has(address)) return false

  const hostHeader = req.headers.host
  if (typeof hostHeader !== 'string') return false
  let hostUrl: URL
  try {
    hostUrl = new URL(`http://${hostHeader}`)
  } catch {
    return false
  }
  if (!LOOPBACK_HOSTS.has(hostUrl.hostname)) return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false

  const origin = req.headers.origin
  if (origin === undefined) return !requireOrigin
  try {
    const originUrl = new URL(origin)
    // Compare host (name + port): `http://127.0.0.1:3080` and `http://localhost:3080` differ.
    return originUrl.host === hostUrl.host
  } catch {
    return false
  }
}
