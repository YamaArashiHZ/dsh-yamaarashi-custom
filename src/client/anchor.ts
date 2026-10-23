/**
 * Anchoring the mascot background to the main content column.
 *
 * The layer lives on `<body>` and must align with the column the active main
 * view occupies. That column exists in every main view (conversation, plugins,
 * scheduled tasks, …), so the wallpaper is not tied to the conversation page.
 *
 * The layout frame is a CSS grid — sidebar | centre | rightbar — and the centre
 * column is the rightbar column's previous element sibling. Its rect gives the
 * viewport-relative offsets. Geometry changes when the window resizes or either
 * sidebar opens/closes/resizes; a ResizeObserver covers those, and a
 * one-second poll covers late mounts and layout swaps cheaply.
 *
 * The hook also marks the centre column with {@link CENTER_COLUMN_ATTR}; the
 * injected stylesheet uses that marker to make the active view's root
 * transparent, so the wallpaper shows through on every page.
 *
 * @module @yamaarashihz/dsh-yamaarashi-custom/client/anchor
 */

import { useEffect, useState } from 'react'

/** Offsets from the viewport edges to the main column's bottom-right corner. */
export interface MainColumnAnchor {
  /** Distance from the viewport right edge to the column's right edge. */
  right: number
  /** Distance from the viewport bottom edge to the column's bottom edge. */
  bottom: number
  /** Column width, used to keep a large mascot inside a narrow column. */
  width: number
}

/** DOM marker set on the layout's centre column (the active main view's parent). */
export const CENTER_COLUMN_ATTR = 'data-yamaarashi-center'

/** The part of a DOMRect the anchor math needs. */
export interface RectLike {
  right: number
  bottom: number
  width: number
  height: number
}

/** The part of the viewport the anchor math needs. */
export interface ViewportLike {
  width: number
  height: number
}

/**
 * Convert the main column rect into viewport-relative offsets.
 * @param rect - centre column bounding rect.
 * @param viewport - current viewport size.
 * @returns offsets, or null while the column has no area (e.g. fullscreen right sidebar).
 */
export function mainColumnAnchor(rect: RectLike, viewport: ViewportLike): MainColumnAnchor | null {
  if (rect.width <= 0 || rect.height <= 0) return null
  return {
    right: Math.max(0, viewport.width - rect.right),
    bottom: Math.max(0, viewport.height - rect.bottom),
    width: rect.width,
  }
}

/** Resolved layout elements of one measurement. */
interface FrameParts {
  frame: HTMLElement | null
  rightbar: HTMLElement | null
  center: HTMLElement | null
}

/** Locate the frame, the right sidebar column and the centre column. */
function locateFrameParts(doc: Document): FrameParts {
  const frame = doc.querySelector<HTMLElement>('[data-shell-overlay]')?.parentElement ?? null
  const rightbar = frame?.querySelector<HTMLElement>('[data-rightbar-col]') ?? null
  const center = (rightbar?.previousElementSibling as HTMLElement | null)
    ?? (frame?.children[1] as HTMLElement | undefined)
    ?? null
  return { frame, rightbar, center }
}

/**
 * Track the main content column's bottom-right corner and mark it for CSS.
 * @returns live anchor offsets, or null while the main column is not on screen.
 */
export function useMainColumnAnchor(): MainColumnAnchor | null {
  const [anchor, setAnchor] = useState<MainColumnAnchor | null>(null)

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined
    let observed: HTMLElement[] = []
    let observer: ResizeObserver | undefined
    let marked: HTMLElement | null = null
    let lastKey = 'unset'

    const apply = (next: MainColumnAnchor | null): void => {
      const key = next === null
        ? 'none'
        : `${Math.round(next.right)}:${Math.round(next.bottom)}:${Math.round(next.width)}`
      if (key === lastKey) return
      lastKey = key
      setAnchor(next)
    }

    const observe = (elements: HTMLElement[]): void => {
      if (typeof ResizeObserver === 'undefined') return
      if (elements.length === observed.length && elements.every((element, index) => element === observed[index])) return
      observer?.disconnect()
      observer = new ResizeObserver(() => { measure() })
      for (const element of elements) observer.observe(element)
      observed = elements
    }

    function measure(): void {
      const { frame, rightbar, center } = locateFrameParts(document)
      if (center === null) {
        apply(null)
        return
      }
      if (center !== marked) {
        marked?.removeAttribute(CENTER_COLUMN_ATTR)
        center.setAttribute(CENTER_COLUMN_ATTR, '')
        marked = center
      }
      observe([frame, rightbar, center].filter((element): element is HTMLElement => element !== null))
      apply(mainColumnAnchor(center.getBoundingClientRect(), {
        width: window.innerWidth,
        height: window.innerHeight,
      }))
    }

    measure()
    const timer = window.setInterval(measure, 1000)
    const onResize = (): void => { measure() }
    window.addEventListener('resize', onResize)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('resize', onResize)
      observer?.disconnect()
      marked?.removeAttribute(CENTER_COLUMN_ATTR)
    }
  }, [])

  return anchor
}
