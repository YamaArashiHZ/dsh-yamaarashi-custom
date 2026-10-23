/**
 * Dafeiyu peek — browser half.
 *
 * One client plugin per PACKAGE: this component ships one package and mounts
 * its own components (mascot wallpaper + row configuration page). Components
 * are isolated: one that throws while mounting is logged and skipped instead of
 * failing the whole client entry (a failed entry fails the page's boot audit).
 *
 * @module @yamaarashihz/dsh-yamaarashi-dafeiyu/client
 */

import { installMascot } from './components/mascot.js'
import { installSettingsPage } from './components/settings.js'
import { ENTRY_ID } from './config.js'
import type { ClientContext } from './contract.js'

export const name = 'dafeiyu/client'

/** `slots` renders the components; `configForms` supplies the live settings section. */
export const inject = ['slots', 'configForms']

/**
 * Mount every component.
 * @param ctx - browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const form = ctx.configForms.get(ENTRY_ID)
  installComponent('mascot', () => installMascot(ctx, form))
  installComponent('settings-page', () => installSettingsPage(ctx, form))

  // Future components append one line each, after adding their Config section
  // and `src/client/components/<id>.tsx`:
  // installComponent('<id>', () => installXxx(ctx, form))
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
    console.error(`[dafeiyu] component "${id}" failed to install`, error)
  }
}
