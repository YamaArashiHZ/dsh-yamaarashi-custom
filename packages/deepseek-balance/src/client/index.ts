/**
 * DeepSeek usage card — browser half.
 *
 * One client plugin per package: this component mounts its own two surfaces —
 * the sidebar card (a portal seated between the sidebar's global panel rows and
 * the workspace region) and the row configuration page under `plugins.row.config`.
 * Mounting is isolated per component: one that throws is logged and skipped
 * instead of failing the whole client entry (a failed entry fails the page's
 * boot audit).
 *
 * The bundle protocol (`window.__ModuleLoader__.load`, package id) lives in
 * `tsdown.config.ts`; this module only exports the plugin contract.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/client
 */

import { ENTRY_ID } from '../shared.js'
import type { ClientContext } from './contract.js'
import { installSidebarSeat } from './sidebar-seat.js'
import { installSettingsPage } from './settings.js'

export const name = 'deepseek-balance/client'

/** `slots` renders the surfaces; `configForms` supplies the live settings section. */
export const inject = ['slots', 'configForms']

/**
 * Mount every surface of this component.
 * @param ctx - browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const form = ctx.configForms.get(ENTRY_ID)
  installComponent('sidebar-card', () => installSidebarSeat(ctx, form))
  installComponent('settings-page', () => installSettingsPage(ctx, form))
}

/**
 * Run one component installer.
 * @param id - component id used in the log line.
 * @param install - mount function of that component.
 */
function installComponent(id: string, install: () => unknown): void {
  try {
    install()
  } catch (error) {
    console.error(`[deepseek-balance] component "${id}" failed to install`, error)
  }
}
