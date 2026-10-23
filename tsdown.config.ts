import type { UserConfig } from 'tsdown'

/**
 * Browser artifact build for the Dafeiyu mascot component.
 *
 * The DSH web shell loads a client plugin as a classic script that must call
 * `window.__ModuleLoader__.load({ id, factory })` with the PACKAGE name and
 * return `module.exports` from the factory. A plain bundler output is therefore
 * not loadable; the banner/footer/intro below are that protocol, copied from
 * `@yamaarashihz/dsh-win-notify`.
 *
 * Only the shell's platform module table may stay external: every other
 * specifier must inline, because a `require()` the table cannot answer is a
 * guaranteed runtime throw inside the browser factory.
 *
 * @module @yamaarashihz/dsh-yamaarashi-dafeiyu/tsdown
 */

const id = '@yamaarashihz/dsh-yamaarashi-dafeiyu'

/** Specifiers the DSH client module table provides at runtime. */
const externals = ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives']

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
