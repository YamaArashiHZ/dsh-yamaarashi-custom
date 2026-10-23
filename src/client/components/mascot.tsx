/**
 * Corner mascot — drawn as a BACKGROUND layer.
 *
 * The image is appended to `<body>` as a `position: fixed; z-index: -1`
 * element, so it sits below every UI element and below scrollbars (the page
 * canvas and scrollbar tracks show through it). To make it visible, the
 * component also lifts the large base surfaces — the app frame, the active
 * main view's root, the bottom seat and the composer's fade mask — while
 * cards, inputs and code blocks keep their own backgrounds, keeping text
 * readable.
 *
 * Geometry is anchored to the main content column, so the same wallpaper shows
 * in every main view (conversation, plugins, scheduled tasks, …) and follows
 * sidebar toggles and window resizes.
 *
 * @module @yamaarashihz/dsh-yamaarashi-custom/client/components/mascot
 */

import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { CENTER_COLUMN_ATTR, useMainColumnAnchor } from '../anchor.js'
import { readMascot } from '../config.js'
import type { ClientContext, ConfigFormService } from '../contract.js'
import { MASCOT_WEBP_DATA_URL } from '../generated/assets.js'

/** Frame-wide slot declared by ui-layout; used only to host this component's lifecycle. */
const OVERLAY_SLOT = 'shell.overlay'
/** Unique registration id; a list slot rejects duplicate ids with the same priority. */
const REGISTRATION_ID = 'yamaarashi-custom-mascot'
/** `data-*` marker of the background image element (also used by tests). */
const LAYER_ATTR = 'data-dsh-corner-mascot'
/** `data-*` marker of the injected stylesheet. */
const RULES_ATTR = 'data-dsh-corner-mascot-rules'

/**
 * CSS that lifts the large base surfaces so the background layer shows through.
 * Small surfaces keep their own backgrounds on purpose.
 * @returns stylesheet text for the injected `<style>` element.
 */
export function mascotBackgroundRules(): string {
  return [
    // App frame: the element whose direct child is the frame-wide overlay seat.
    '*:has(> [data-shell-overlay]) { background: transparent !important; }',
    // Active main view. Slot outlets wrap their content in `display: contents`
    // anchors, so the painted view root is one level deeper than the centre
    // column's direct child.
    `[${CENTER_COLUMN_ATTR}] > *, [${CENTER_COLUMN_ATTR}] > * > * { background: transparent !important; }`,
    // Conversation root by its own marker, independent of slot-anchor nesting.
    '[data-phase]:has([data-conversation-content]) { background: transparent !important; }',
    // Bottom seat (usually collapsed, but it paints the base background when open).
    '[data-shell-bottom] { background: transparent !important; }',
    // The composer's input mask fades the transcript into an opaque band above
    // the input card; lift it so the wallpaper is not blurred/faded there.
    '[data-composer-seat] { background: transparent !important; }',
  ].join('\n')
}

/** One mascot background layer, driven by the live settings section. */
function CornerMascot({ form }: { form: ConfigFormService }): ReactElement | null {
  const [snapshot, setSnapshot] = useState(() => form.getSnapshot())
  useEffect(() => form.subscribe(() => setSnapshot(form.getSnapshot())), [form])

  // `unavailable` can still carry a stale value, so only `ready` values are trusted.
  const config = readMascot(snapshot.status === 'ready' ? snapshot.value : undefined)
  const anchor = useMainColumnAnchor()

  // A custom `/api/file` path can fail (401 when not logged in, moved file):
  // fall back to the bundled image instead of showing a broken image.
  const [sourceFailed, setSourceFailed] = useState(false)
  useEffect(() => { setSourceFailed(false) }, [config.imagePath])

  const visible = config.enabled && anchor !== null
  const width = anchor === null
    ? 0
    : Math.max(64, Math.min(config.sizePx, anchor.width - config.rightPx * 2))
  const customSource = config.imagePath.length > 0 && !sourceFailed
  const source = customSource
    ? `/api/file?path=${encodeURIComponent(config.imagePath)}`
    : MASCOT_WEBP_DATA_URL

  useEffect(() => {
    if (typeof document === 'undefined' || anchor === null || !visible) return undefined

    const image = document.createElement('img')
    image.setAttribute(LAYER_ATTR, '')
    image.alt = ''
    image.draggable = false
    image.src = source
    image.style.position = 'fixed'
    image.style.right = `${anchor.right + config.rightPx}px`
    image.style.bottom = `${anchor.bottom + config.bottomPx}px`
    image.style.width = `${width}px`
    image.style.height = 'auto'
    image.style.opacity = String(config.opacity)
    image.style.zIndex = '-1'
    image.style.pointerEvents = 'none'
    image.style.userSelect = 'none'
    image.onerror = () => { setSourceFailed(true) }

    const rules = document.createElement('style')
    rules.setAttribute(RULES_ATTR, '')
    rules.textContent = mascotBackgroundRules()

    document.body.appendChild(rules)
    document.body.appendChild(image)

    return () => {
      image.onerror = null
      image.remove()
      rules.remove()
    }
  }, [anchor, visible, width, source, config.rightPx, config.bottomPx, config.opacity])

  // The background element lives on <body>; nothing renders inside the overlay slot.
  return null
}

/**
 * Mount the mascot background layer.
 * @param ctx - browser plugin context.
 * @param form - live config form of the `dafeiyu` namespace.
 * @returns the slot registration disposer, owned by the caller's fiber.
 */
export function installMascot(ctx: ClientContext, form: ConfigFormService): (() => void) | void {
  return ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register(
    { name: OVERLAY_SLOT, id: REGISTRATION_ID },
    () => <CornerMascot form={form} />,
  ))
}
