import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const ROLE_STYLE_SCOPES: Array<[RegExp, string]> = [
  [/\/(?:supervisor-[^/]+)\.scss$/, '.role-supervisor'],
  [/\/(?:commercial-[^/]+)\.scss$/, '.role-commercial-user'],
  [/\/(?:backoffice-[^/]+)\.scss$/, '.role-backoffice'],
  [/\/(?:commercant-[^/]+)\.scss$/, '.role-merchant'],
  [/\/workspace-commercant-drawer\.scss$/, '.role-merchant']
]

function resolveRoleStyleScope(sourceFile: string | undefined): string | null {
  if (!sourceFile) return null
  const normalizedSource = sourceFile.replace(/\\/g, '/')
  return ROLE_STYLE_SCOPES.find(([pattern]) => pattern.test(normalizedSource))?.[1] ?? null
}

function isInsideKeyframes(rule: { parent?: unknown }): boolean {
  let parent = rule.parent as { type?: string; name?: string; parent?: unknown } | undefined
  while (parent) {
    if (parent.type === 'atrule' && /keyframes$/i.test(parent.name ?? '')) return true
    parent = parent.parent as typeof parent
  }
  return false
}

function scopeRoleSelector(selector: string, scope: string): string {
  const trimmed = selector.trim()
  if (!trimmed || trimmed.includes(scope)) return trimmed

  if (trimmed.startsWith(':root')) {
    return trimmed.replace(':root', scope)
  }

  if (trimmed.startsWith(':host-context(.dark)')) {
    return trimmed.replace(':host-context(.dark)', `[data-theme="dark"] ${scope}`)
  }

  if (trimmed.startsWith(':host')) {
    return trimmed.replace(':host', scope)
  }

  if (trimmed.startsWith('html[data-theme') || trimmed.startsWith('body[data-theme')) {
    return trimmed.replace(/^(html|body)(\[[^\]]+\])/, `$1$2 ${scope}`)
  }

  if (trimmed.startsWith('[data-theme')) {
    return trimmed.replace(/^(\[[^\]]+\])/, `$1 ${scope}`)
  }

  // The role marker and .ws-shell live on the same DOM element.
  // Keep root-shell rules applicable instead of turning them into descendants.
  if (/^\.ws-shell(?=[.#:\[\s>+~]|$)/.test(trimmed)) {
    return trimmed.replace(/^\.ws-shell/, `.ws-shell${scope}`)
  }

  return `${scope} ${trimmed}`
}

const scopeWorkspaceRoleStyles = {
  postcssPlugin: 'scope-workspace-role-styles',
  Once(root: any, { result }: any) {
    const scope = resolveRoleStyleScope(result.opts.from)
    if (!scope) return

    root.walkRules((rule: any) => {
      if (isInsideKeyframes(rule)) return

      // Role styles historically put both CSS variables and document-level
      // layout declarations inside :root.  When :root is replaced by the
      // role class, declarations such as `display: block` would otherwise be
      // applied to .ws-shell and break its horizontal flex layout.  Keep only
      // the role tokens on the scoped shell; the shared workspace stylesheet
      // remains responsible for the shell structure.
      if (rule.selectors.every((selector: string) => selector.trim() === ':root')) {
        rule.walkDecls((declaration: any) => {
          if (!declaration.prop.startsWith('--')) declaration.remove()
        })
      }

      rule.selectors = rule.selectors.map((selector: string) => scopeRoleSelector(selector, scope))
    })
  }
}

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: { plugins: [scopeWorkspaceRoleStyles] },
    preprocessorOptions: { scss: { api: 'modern-compiler' } }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          charts: ['chart.js'],
          maps: ['leaflet', 'react-leaflet', 'react-leaflet-cluster'],
          auth: ['keycloak-js'],
          http: ['axios', 'zustand']
        }
      }
    }
  },
  server: {
    port: 4200,
    // Pre-transform every page module (and its SCSS chain) as soon as the
    // dev server boots, instead of on first visit. Without this, each
    // route's TSX + `@use`-chained SCSS is only compiled the first time it
    // is navigated to after a (re)start, which shows up as the page/design
    // taking a few seconds to appear on that first visit.
    warmup: {
      clientFiles: ['./src/main.tsx', './src/modules/**/pages/**/*.tsx']
    },
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    css: true,
    // tests/e2e/*.spec.ts sont des specs Playwright (test:e2e, autre binaire,
    // autre workflow CI) : sans cette exclusion, Vitest les ramasse aussi via
    // son pattern par defaut **/*.spec.ts et essaie de les executer avec le
    // mauvais runner, ce qui les fait echouer systematiquement ("Playwright
    // Test did not expect test() to be called here") et fait echouer tout
    // "npm test" / le workflow CI frontend-tests.yml, alors que les 567 vrais
    // tests unitaires/composants passent.
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      // 'lcov' en plus de text/html : lu par sonar-project.properties
      // (sonar.javascript.lcov.reportPaths) pour la couverture SonarQube.
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/main.tsx', 'src/test/**']
    }
  }
})
