/**
 * Shared configuration vocabulary for the browser half.
 *
 * Mirrors the host schema in `src/index.ts` (no host import) and adds the
 * defensive fallbacks used when the settings namespace is not served yet.
 *
 * @module @yamaarashihz/dsh-yamaarashi-dafeiyu/client/config
 */

/** Loader row id == settings namespace (`ctx.configForms.get(...)`). */
export const ENTRY_ID = 'dafeiyu'

/**
 * The bundle (shell) package that declares this component's row. The row's
 * configuration page is keyed `<bundle package>#<row id>`.
 */
export const SHELL_PACKAGE = '@yamaarashihz/dsh-yamaarashi-custom'

/** `plugins.row.config` key used by the Plugins page for this component row. */
export const ROW_CONFIG_KEY = `${SHELL_PACKAGE}#${ENTRY_ID}`

/** Corner-mascot settings (mirror of `MascotSettings` in the host half). */
export interface MascotConfig {
  enabled: boolean
  sizePx: number
  rightPx: number
  bottomPx: number
  opacity: number
  imagePath: string
}

/** Schema defaults; the browser keeps rendering correctly before the first snapshot arrives. */
export const MASCOT_DEFAULTS: MascotConfig = {
  enabled: true,
  sizePx: 200,
  rightPx: 24,
  bottomPx: 168,
  opacity: 1,
  imagePath: '',
}

/** Narrow an unknown settings value to an object without trusting it. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined
}

/** Take a typed field from the snapshot, falling back to the schema default. */
function readField<T>(
  source: Record<string, unknown> | undefined,
  key: string,
  fallback: T,
): T {
  const value = source?.[key]
  return typeof value === typeof fallback ? value as T : fallback
}

/**
 * Read the `components.mascot` section from a settings snapshot value.
 * @param value - `snapshot.value` of the `dafeiyu` namespace.
 * @returns the mascot settings, never partially undefined.
 */
export function readMascot(value: unknown): MascotConfig {
  const mascot = asRecord(asRecord(asRecord(value)?.components)?.mascot)
  return {
    enabled: readField(mascot, 'enabled', MASCOT_DEFAULTS.enabled),
    sizePx: readField(mascot, 'sizePx', MASCOT_DEFAULTS.sizePx),
    rightPx: readField(mascot, 'rightPx', MASCOT_DEFAULTS.rightPx),
    bottomPx: readField(mascot, 'bottomPx', MASCOT_DEFAULTS.bottomPx),
    opacity: readField(mascot, 'opacity', MASCOT_DEFAULTS.opacity),
    imagePath: readField(mascot, 'imagePath', MASCOT_DEFAULTS.imagePath),
  }
}
