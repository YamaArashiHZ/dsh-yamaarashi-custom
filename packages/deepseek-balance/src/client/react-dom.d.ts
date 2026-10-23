/**
 * Ambient declaration for the platform's `react-dom` external.
 *
 * `react-dom` is one of the shell's frozen platform modules
 * (`packages/client/web/src/platform.ts`), so the bundled factory requires it
 * from the runtime table. This workspace's checked-in `node_modules` (root and
 * package level) does not install `@types/react-dom`, and the package tsconfig
 * cannot be given a `paths` entry from the client half; declaring the single
 * function the card uses keeps the import typed.
 *
 * If `@types/react-dom` is installed later, this declaration merges with it as
 * a set of overloads; the call site below stays valid either way.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/client/react-dom
 */

declare module 'react-dom' {
  import type { ReactElement, ReactNode } from 'react'

  /**
   * Render children into a DOM node that lives outside the React tree.
   * @param children - React children.
   * @param container - DOM node receiving the children.
   * @param key - optional portal key.
   * @returns the portal element to render.
   */
  export function createPortal(
    children: ReactNode,
    container: Element | DocumentFragment,
    key?: string | number | null,
  ): ReactElement
}
