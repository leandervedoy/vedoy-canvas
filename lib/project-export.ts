export type Target = 'next' | 'react' | 'react-native' | 'angular' | 'forge' | 'vue' | 'html'

export type SourceFiles = {
  'index.html': string
  'styles.css': string
  'script.js': string
}

export type ExportFile = { path: string; content: string }
export type ExportBundle = { name: string; files: ExportFile[]; readme: string }

export const targets: Array<{ id: Target; label: string; extension: string }> = [
  { id: 'next', label: 'Next.js', extension: 'ZIP' },
  { id: 'react', label: 'React', extension: 'ZIP' },
  { id: 'react-native', label: 'React Native', extension: 'ZIP' },
  { id: 'angular', label: 'Angular', extension: 'ZIP' },
  { id: 'forge', label: 'Vedøy Forge + VedoyScript', extension: 'ZIP' },
  { id: 'vue', label: 'Vue.js', extension: 'ZIP' },
  { id: 'html', label: 'Ren HTML', extension: 'HTML' },
]

function bodyFromHtml(html: string) {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]
  return (body ?? html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').trim()
}

function fullDocument(source: SourceFiles) {
  const body = bodyFromHtml(source['index.html'])
  return `<!doctype html>
<html lang="no">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vedøy Canvas eksport</title>
  <style>\n${source['styles.css']}\n</style>
</head>
<body>
${body}
<script>\n${source['script.js']}\n</script>
</body>
</html>`
}

function readme(framework: string, command: string) {
  return '# Vedøy Canvas export — ' + framework + '\n\nGenerated from a Vedøy Canvas project.\n\nRun `npm install`, then `' + command + '`. Edit the generated framework files to continue building.'
}

export function createExportBundle(target: Target, source: SourceFiles): ExportBundle {
  const html = fullDocument(source)
  const body = bodyFromHtml(source['index.html'])
  const name = `vedoy-canvas-${target}`

  if (target === 'html') return { name: 'index.html', files: [{ path: 'index.html', content: html }], readme: '' }

  if (target === 'react-native') {
    return {
      name,
      readme: readme('React Native', 'npx expo start'),
      files: [
        { path: 'package.json', content: JSON.stringify({ name, version: '1.0.0', main: 'node_modules/expo/AppEntry.js', scripts: { start: 'expo start', android: 'expo start --android', ios: 'expo start --ios' }, dependencies: { expo: '~54.0.0', react: '19.1.0', 'react-native': '0.81.4', 'react-native-webview': '13.15.0' }, devDependencies: { '@types/react': '~19.1.10', typescript: '~5.9.2' }, private: true }, null, 2) },
        { path: 'App.js', content: `import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const page = ${JSON.stringify(html)};

export default function App() {
  return <SafeAreaView style={styles.root}><WebView source={{ html: page }} originWhitelist={['*']} javaScriptEnabled /></SafeAreaView>;
}

const styles = StyleSheet.create({ root: { flex: 1 } });
` },
        { path: 'README.md', content: readme('React Native / Expo', 'npx expo start') },
      ],
    }
  }

  if (target === 'forge') {
    return {
      name,
      readme: `# Vedøy Forge project

The browser-ready page is in ` + '`' + `src/index.html` + '`' + `. The `.vdy` file uses the current VedoyScript starter syntax supported by the VedoyScript compiler. That compiler currently supports functions, simple ` + '`Let`' + ` bindings and ` + '`Return`' + ` statements, so the complete HTML/CSS/JavaScript remains in the web assets until Forge's web compiler is available.

Open ` + '`' + `src/index.html` + '`' + ` directly to preview the exported page.
`,
      files: [
        { path: 'src/index.html', content: html },
        { path: 'src/main.vdy', content: `# VedoyScript entry point for this exported page.
Function GetPageTitle():
    Let Title = "Canvas export".
    Return Title.
` },
        { path: 'README.md', content: `# Vedøy Forge + VedoyScript export

The generated page is in ` + '`' + `src/index.html` + '`' + `. The ` + '`' + `src/main.vdy` + '`' + ` file is valid with the current VedoyScript starter compiler. The current compiler does not yet compile HTML, CSS, or browser JavaScript; those assets are kept as a standard HTML page.

Open ` + '`' + `src/index.html` + '`' + ` to run the page.
` },
      ],
    }
  }

  if (target === 'vue') {
    return {
      name,
      readme: readme('Vue.js', 'npm run dev'),
      files: [
        { path: 'package.json', content: JSON.stringify({ name, version: '1.0.0', type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' }, dependencies: { vue: '^3.5.0' }, devDependencies: { '@vitejs/plugin-vue': '^5.2.0', vite: '^6.0.0' } }, null, 2) },
        { path: 'index.html', content: '<!doctype html><html lang="no"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Canvas export</title></head><body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>' },
        { path: 'src/App.vue', content: `<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import './styles.css'
const markup = ${JSON.stringify(body)}
let pageScriptElement
onMounted(() => { const script = document.createElement('script'); script.textContent = ${JSON.stringify(source['script.js'])}; document.body.appendChild(script); pageScriptElement = script })
onBeforeUnmount(() => pageScriptElement?.remove())
</script>

<template>
  <main v-html="markup"></main>
</template>
` },
        { path: 'src/main.js', content: `import { createApp } from 'vue'
import App from './App.vue'
createApp(App).mount('#app')
` },
        { path: 'src/styles.css', content: source['styles.css'] },
        { path: 'README.md', content: readme('Vue.js', 'npm run dev') },
      ],
    }
  }

  if (target === 'angular') {
    return {
      name,
      readme: readme('Angular', 'npm start'),
      files: [
        { path: 'package.json', content: JSON.stringify({ name, version: '1.0.0', scripts: { start: 'ng serve', build: 'ng build' }, dependencies: { '@angular/common': '^20.0.0', '@angular/compiler': '^20.0.0', '@angular/core': '^20.0.0', '@angular/platform-browser': '^20.0.0', rxjs: '~7.8.0', tslib: '^2.8.0', 'zone.js': '~0.15.0' }, devDependencies: { '@angular/cli': '^20.0.0', '@angular/build': '^20.0.0', '@angular/compiler-cli': '^20.0.0', typescript: '~5.8.0' } }, null, 2) },
        { path: 'angular.json', content: JSON.stringify({ '$schema': './node_modules/@angular/cli/lib/config/schema.json', version: 1, projects: { [name]: { projectType: 'application', root: '', sourceRoot: 'src', architect: { build: { builder: '@angular/build:application', options: { browser: 'src/main.ts', index: 'src/index.html', styles: ['src/styles.css'], tsConfig: 'tsconfig.app.json' } }, serve: { builder: '@angular/build:dev-server', options: { buildTarget: `${name}:build` } } } } } }, null, 2) },
        { path: 'src/index.html', content: '<!doctype html><html lang="no"><head><meta charset="utf-8"><title>Canvas export</title><base href="/"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><app-root></app-root></body></html>' },
        { path: 'src/main.ts', content: `import { bootstrapApplication } from '@angular/platform-browser'
import { AppComponent } from './app/app.component'
bootstrapApplication(AppComponent).catch((error) => console.error(error))
` },
        { path: 'src/app/app.component.ts', content: `import { AfterViewInit, Component } from '@angular/core'

@Component({ selector: 'app-root', standalone: true, template: ${JSON.stringify(body)} })
export class AppComponent implements AfterViewInit {
  ngAfterViewInit() {
    const script = document.createElement('script')
    script.textContent = ${JSON.stringify(source['script.js'])}
    document.body.appendChild(script)
  }
}
` },
        { path: 'src/styles.css', content: source['styles.css'] },
        { path: 'tsconfig.app.json', content: JSON.stringify({ extends: './tsconfig.json', compilerOptions: { outDir: './out-tsc/app', types: [] }, files: ['src/main.ts'], include: ['src/**/*.d.ts'] }, null, 2) },
        { path: 'tsconfig.json', content: JSON.stringify({ compileOnSave: false, compilerOptions: { outDir: './dist/out-tsc', strict: true, noImplicitOverride: true, noPropertyAccessFromIndexSignature: true, noImplicitReturns: true, noFallthroughCasesInSwitch: true, skipLibCheck: true, esModuleInterop: true, sourceMap: true, declaration: false, experimentalDecorators: true, moduleResolution: 'bundler', importHelpers: true, target: 'ES2022', module: 'preserve', lib: ['ES2022', 'dom'] }, angularCompilerOptions: { enableI18nLegacyMessageIdFormat: false, strictInjectionParameters: true, strictInputAccessModifiers: true, strictTemplates: true } }, null, 2) },
        { path: 'README.md', content: readme('Angular', 'npm start') },
      ],
    }
  }

  const reactApp = `import { useEffect } from 'react'
import './styles.css'

const markup = ${JSON.stringify(body)}
const pageScript = ${JSON.stringify(source['script.js'])}

export default function App() {
  useEffect(() => {
    const root = document.getElementById('canvas-page')
    if (root) root.innerHTML = markup
    const script = document.createElement('script')
    script.textContent = pageScript
    document.body.appendChild(script)
    return () => script.remove()
  }, [])
  return <main id="canvas-page" />
}
`

  if (target === 'react') {
    return {
      name,
      readme: readme('React', 'npm run dev'),
      files: [
        { path: 'package.json', content: JSON.stringify({ name, version: '1.0.0', type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' }, dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }, devDependencies: { '@vitejs/plugin-react': '^4.3.0', vite: '^6.0.0' } }, null, 2) },
        { path: 'index.html', content: '<!doctype html><html lang="no"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Canvas export</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>' },
        { path: 'src/App.jsx', content: reactApp },
        { path: 'src/main.jsx', content: `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
` },
        { path: 'src/styles.css', content: source['styles.css'] },
        { path: 'README.md', content: readme('React', 'npm run dev') },
      ],
    }
  }

  return {
    name,
    readme: readme('Next.js', 'npm run dev'),
    files: [
      { path: 'package.json', content: JSON.stringify({ name, version: '1.0.0', scripts: { dev: 'next dev', build: 'next build', start: 'next start' }, dependencies: { next: '^15.0.0', react: '^19.0.0', 'react-dom': '^19.0.0' } }, null, 2) },
      { path: 'app/layout.jsx', content: `import './globals.css'
export const metadata = { title: 'Canvas export', description: 'Exported from Vedøy Canvas' }
export default function RootLayout({ children }) { return <html lang="no"><body>{children}</body></html> }
` },
      { path: 'app/page.jsx', content: `'use client'
import { useEffect } from 'react'
export default function Page() {
  useEffect(() => {
    const root = document.getElementById('canvas-page')
    if (root) root.innerHTML = ${JSON.stringify(body)}
    const script = document.createElement('script')
    script.textContent = ${JSON.stringify(source['script.js'])}
    document.body.appendChild(script)
    return () => script.remove()
  }, [])
  return <main id="canvas-page" />
}
` },
      { path: 'app/globals.css', content: source['styles.css'] },
      { path: 'README.md', content: readme('Next.js', 'npm run dev') },
    ],
  }
}
