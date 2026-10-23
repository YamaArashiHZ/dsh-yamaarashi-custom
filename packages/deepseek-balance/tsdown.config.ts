import type { UserConfig } from 'tsdown'

/**
 * Browser artifact build for the DeepSeek usage card component.
 *
 * DSH loads a client plugin as a classic script that must call
 * `window.__ModuleLoader__.load({ id, factory })` with the PACKAGE name and
 * return `module.exports` from the factory. The banner/footer/intro below are
 * that protocol.
 *
 * Only the shell's platform module table may stay external. `react-dom` is on
 * that table (`packages/client/web/src/platform.ts`) and this component uses
 * `createPortal`, so it is the third external besides react and the primitives.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/tsdown
 */

const id = '@yamaarashihz/dsh-yamaarashi-deepseek-balance'

/** Specifiers the DSH client module table provides at runtime. */
const externals = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@deepseek-ai/dsh-client-ui-primitives',
]

const config: UserConfig = {
  name: `${id}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    // Only the loader's platform module table may stay external.
    neverBundle: (moduleId: string) => externals.includes(moduleId),
    alwaysBundle: (moduleId: string) => !externals.includes(moduleId),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default config
