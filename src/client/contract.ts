/**
 * Structural browser contracts shared by every personalization component.
 *
 * Kept local (no `@deepseek-ai/dsh-client-*` imports) so the package's browser
 * bundle depends only on the loader's platform module table.
 *
 * @module @yamaarashihz/dsh-yamaarashi-custom/client/contract
 */

import type { ComponentType } from 'react'

/** Registration options of one slot contribution (list slots use `id`, keyed slots use `key`). */
export interface SlotRegistrationOptions {
  name: string
  /** Unique id inside a list slot. */
  id?: string
  /** Key inside a keyed slot. */
  key?: string
  order?: number
}

/** Slot service slice this bundle uses (`ctx.slots`). */
export interface SlotsService {
  /** Run `setup` once the slot is declared; re-run when its declaration epoch changes. */
  inject(name: string, setup: () => (() => void) | void): () => void
  /** Register one component into a declared slot. */
  register(options: SlotRegistrationOptions, component: ComponentType<never>): () => void
}

/** Sync state of one settings namespace. */
export interface ConfigFormSnapshot<T> {
  /** `ready` carries accepted values; `unavailable` means this client is not served the namespace. */
  status: 'loading' | 'ready' | 'unavailable'
  /** Last accepted, schema-resolved section. */
  value: T | undefined
}

/** Path-addressed settings write — the only way to edit nested sections. */
export interface SettingsPathOp {
  op: 'set'
  path: readonly string[]
  value: unknown
}

/** Configuration form of one loader row (`ctx.configForms.get(ns)`). */
export interface ConfigFormService<T = unknown> {
  getSnapshot(): ConfigFormSnapshot<T>
  subscribe(listener: () => void): () => void
  mutate(ops: readonly SettingsPathOp[], expectedRevision?: number): Promise<boolean>
}

/** Configuration-form service slice this bundle uses (`ctx.configForms`). */
export interface ConfigFormsService {
  get(namespace: string): ConfigFormService
  /** Keep a contribution alive while the Host serves at least one of these namespaces. */
  whileServed(namespaces: readonly string[], register: () => () => void): () => void
}

/** Browser plugin context this bundle needs. */
export interface ClientContext {
  slots: SlotsService
  configForms: ConfigFormsService
}
