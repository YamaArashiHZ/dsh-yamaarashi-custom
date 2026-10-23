/**
 * Sidebar seat: where the card lives in the shell's DOM.
 *
 * The card belongs between the global panel rows and the workspace region of
 * the left sidebar. No DSH slot exposes that seam (the sidebar slot is occupied
 * by the whole column), so this component renders through a React portal into a
 * container node it inserts itself:
 *
 *   `[data-shell-overlay]`'s parent (frame)
 *     → `[data-rightbar-col]` → previous sibling (centre column)
 *     → previous sibling (sidebar column) → real sidebar root
 *     → after `:scope > nav` (global panel rows), else before the
 *       second-to-last child (the workspace region seat).
 *
 * The sidebar slot's outlet wrapper is `display: contents`, so the locator
 * descends through at most a few `data-slot`/`display: contents` anchors before
 * accepting the first ordinary element as the root.
 *
 * React re-renders the sidebar (route changes, collapse, panels) and can drop a
 * node it does not own. A body-wide `MutationObserver` therefore re-inserts the
 * SAME container whenever it becomes disconnected; the portal content stays
 * mounted, so no state or request is lost. If the sidebar is not mounted yet
 * the observer simply retries on the next mutation.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/client/sidebar-seat
 */

import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { UsageCard } from './card.js'
import { readBalanceCardConfig } from './config.js'
import type { ClientContext, ConfigFormService } from './contract.js'
import { CARD_ATTR, installBalanceRules, removeBalanceRules } from './styles.js'

/** Frame-wide list slot: mounted for the whole shell lifetime and additive. */
const OVERLAY_SLOT = 'shell.overlay'
/** Unique registration id inside that list slot. */
const REGISTRATION_ID = 'deepseek-balance-card'
/** Maximum wrapper anchors between the layout column and the sidebar root. */
const MAX_WRAPPER_DEPTH = 4

/** Narrow an element reference without assuming the same JS realm. */
function asElement(value: Element | null | undefined): HTMLElement | null {
  return value !== null && value !== undefined && value.nodeType === 1
    ? value as HTMLElement
    : null
}

/** First element child as an HTMLElement. */
function firstElement(parent: HTMLElement): HTMLElement | null {
  return asElement(parent.firstElementChild)
}

/** Whether this element is a slot outlet wrapper rather than real content. */
function isSlotWrapper(element: HTMLElement): boolean {
  if (element.hasAttribute('data-slot')) return true
  const style = element.getAttribute('style')
  return style !== null && style.replace(/\s+/g, '').includes('display:contents')
}

/**
 * Find the left sidebar's root element from the frame's structure.
 * @param doc - document to query.
 * @returns the sidebar root, or null when the layout is not mounted (yet).
 */
export function findSidebarRoot(doc: Document): HTMLElement | null {
  const overlay = doc.querySelector('[data-shell-overlay]')
  const frame = asElement(overlay?.parentElement)
  if (frame === null) return null
  const rightbar = asElement(frame.querySelector('[data-rightbar-col]'))
  if (rightbar === null) return null
  const centre = asElement(rightbar.previousElementSibling) ?? asElement(frame.children[1])
  if (centre === null) return null
  const column = asElement(centre.previousElementSibling)
  if (column === null) return null
  let node: HTMLElement = column
  for (let depth = 0; depth < MAX_WRAPPER_DEPTH; depth += 1) {
    const child = firstElement(node)
    if (child === null) return null
    if (isSlotWrapper(child)) {
      node = child
      continue
    }
    return child
  }
  return null
}

/** First direct child element with the given tag name. */
function directChild(root: HTMLElement, tagName: string): HTMLElement | null {
  for (const child of Array.from(root.children)) {
    if (child.tagName === tagName) return asElement(child)
  }
  return null
}

/**
 * Insert (or move) the container into the sidebar's seam.
 * @param container - the card container node (same node is re-used).
 * @param doc - document whose sidebar receives it.
 * @returns true when the container is seated; false while the sidebar is absent.
 */
export function placeBalanceCard(container: HTMLElement, doc: Document): boolean {
  const root = findSidebarRoot(doc)
  if (root === null) return false
  try {
    const nav = directChild(root, 'NAV')
    if (nav !== null) {
      // Already seated right after the panel list: nothing to do. React can
      // insert a nav that was initially absent without moving our node, so the
      // position (not just connectivity) must be re-checked on every mutation.
      if (container.parentElement === root && container.previousElementSibling === nav) return true
      const next = nav.nextElementSibling
      if (next === null || next === container) root.appendChild(container)
      else root.insertBefore(container, next)
      return true
    }
    // Fallback: the workspace region is the second-to-last child
    // (…, nav, region, foot); insert before it.
    const children = root.children
    const region = children.length >= 2 ? children[children.length - 2] : null
    if (region !== null && region !== container.nextElementSibling) {
      root.insertBefore(container, region)
      return true
    }
    if (container.parentElement === root) return true
    root.appendChild(container)
    return true
  } catch {
    return false
  }
}

/**
 * Card seat component: owns the container, the stylesheet and the observer.
 * @param props.form - live config form of the `deepseek-balance` namespace.
 * @returns a portal into the sidebar container, or null while disabled/unseated.
 */
export function SidebarSeat({ form }: { form: ConfigFormService }): ReactElement | null {
  const [snapshot, setSnapshot] = useState(() => form.getSnapshot())
  useEffect(() => form.subscribe(() => setSnapshot(form.getSnapshot())), [form])

  // `unavailable` can still carry a stale value, so only `ready` values are trusted.
  const config = readBalanceCardConfig(snapshot.status === 'ready' ? snapshot.value : undefined)
  const enabled = config.enabled
  const [container, setContainer] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!enabled) return undefined
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return undefined

    const element = document.createElement('div')
    element.setAttribute(CARD_ATTR, '')
    installBalanceRules(document)
    placeBalanceCard(element, document)
    setContainer(element)

    const observer = new MutationObserver(() => {
      // Fast path: seated right after the panel nav means nothing to do. React
      // may insert a nav that was initially absent without moving our unowned
      // node, and a disconnected container must be re-seated, so anything else
      // pays for the full structural check.
      if (element.isConnected && element.previousElementSibling?.tagName === 'NAV') return
      placeBalanceCard(element, document)
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      element.remove()
      removeBalanceRules(document)
      setContainer(current => (current === element ? null : current))
    }
  }, [enabled])

  if (!enabled || container === null) return null
  return createPortal(<UsageCard config={config} />, container)
}

/**
 * Mount the sidebar card.
 * @param ctx - browser plugin context.
 * @param form - live config form of the `deepseek-balance` namespace.
 * @returns the slot registration disposer, owned by the caller's fiber.
 */
export function installSidebarSeat(ctx: ClientContext, form: ConfigFormService): (() => void) | void {
  return ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register(
    { name: OVERLAY_SLOT, id: REGISTRATION_ID },
    () => <SidebarSeat form={form} />,
  ))
}
