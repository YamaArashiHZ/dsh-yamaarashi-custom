/**
 * Dafeiyu peek — host half.
 *
 * One component of the DSH customization suite. The suite shell
 * (`@yamaarashihz/dsh-yamaarashi-custom`) declares this package as one row of
 * its bundle, with the row id `dafeiyu`; that id is this component's
 * settings namespace and its configuration page key.
 *
 * Every leaf field is `.volatile()`: the settings service projects volatile
 * fields to the browser and edits apply without restarting the host. The
 * object nodes themselves must NOT be volatile (schemastery requires fixed
 * object paths with no enclosing volatile node).
 *
 * @module @yamaarashihz/dsh-yamaarashi-dafeiyu
 */

import z from '@deepseek-ai/schemastery'

/** Host surface this half uses, kept structural so the package needs no host dependency types. */
interface HostChild {
  /** Run a registration and tie its disposer to the owning fiber. */
  effect(setup: () => void | (() => void)): void
  settings: {
    /** Register this instance's auto-page policy; config read/write is unaffected. */
    configure(presentation: { auto?: boolean }, owner?: unknown): () => void
  }
}
interface HostContext {
  fiber: unknown
  inject(names: string[], callback: (child: HostChild) => void): void
}

/**
 * Corner-mascot component settings.
 *
 * The mascot is drawn as a BACKGROUND layer: it sits under every UI element and
 * under scrollbars. Its geometry is anchored to the conversation column, so the
 * offsets are relative to that column's bottom-right corner.
 */
export interface MascotSettings {
  /** Master switch for this component. */
  enabled: boolean
  /** Rendered width in CSS pixels; height follows the image aspect ratio. */
  sizePx: number
  /** Distance from the right edge of the conversation column. */
  rightPx: number
  /** Distance from the bottom edge of the conversation column. */
  bottomPx: number
  /** Image opacity (0.2–1). */
  opacity: number
  /** Optional absolute local image path served through `/api/file`; empty keeps the bundled image. */
  imagePath: string
}

/** One component's settings; add a sibling section per future component. */
export interface CustomSettings {
  mascot: MascotSettings
}

/** Bundle configuration. */
export interface Config {
  components: CustomSettings
}

/** Schema defaults, mirrored by the browser half for defensive fallback. */
const MASCOT_DEFAULTS: MascotSettings = {
  enabled: true,
  sizePx: 200,
  rightPx: 24,
  bottomPx: 168,
  opacity: 1,
  imagePath: '',
}

export const Config = z.object({
  components: z.object({
    mascot: z.object({
      enabled: z.boolean().default(MASCOT_DEFAULTS.enabled).volatile(),
      sizePx: z.number().step(1).min(64).max(512).default(MASCOT_DEFAULTS.sizePx).volatile(),
      rightPx: z.number().step(1).min(0).max(400).default(MASCOT_DEFAULTS.rightPx).volatile(),
      bottomPx: z.number().step(1).min(0).max(400).default(MASCOT_DEFAULTS.bottomPx).volatile(),
      opacity: z.number().step(0.05).min(0.2).max(1).default(MASCOT_DEFAULTS.opacity).volatile(),
      imagePath: z.string().default(MASCOT_DEFAULTS.imagePath).volatile(),
    }).default({ ...MASCOT_DEFAULTS }),
  }).default({ mascot: { ...MASCOT_DEFAULTS } }),
})

export const name = 'dafeiyu'

/**
 * Host entry point: no runtime behavior yet — the bundle is client-side.
 * Registering the auto-page policy only says "this instance does not need a
 * generated settings page"; config projection and hot reload are unchanged.
 * @param ctx - host plugin context.
 */
export function apply(ctx: HostContext): void {
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })
}
