# Vedøy Canvas

Vedøy Canvas is a browser-based code workspace for building small web pages. The editor works with a shared HTML, CSS and JavaScript project. The live preview can be opened or hidden while editing and updates as code changes.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Editor

- Edit `index.html`, `styles.css` and `script.js` in the file explorer.
- See changes in the live preview panel; on narrow screens it opens as a full-screen preview window.
- Draft code is saved to this browser's local storage. Use Ctrl+S / Cmd+S to save immediately.
- Export a standalone HTML file or a ZIP scaffold for Next.js, React, React Native/Expo, Angular, Vue.js, or Vedøy Forge with VedoyScript.

## Export notes

Web framework exports carry the authored HTML as markup and include the CSS and browser JavaScript as project assets or initialization code. React Native uses Expo WebView to preserve the web page on mobile.

The Vedøy Forge export includes the page as standard HTML plus a `.vdy` starter source. The current VedoyScript compiler supports functions, `Let` bindings and `Return` statements; it does not yet compile HTML, CSS or browser JavaScript. The export labels this boundary in its README instead of implying the web assets were compiled to VedoyScript.

## Current storage

The editor draft remains in local browser storage. Cloud sync, Git integration, language services and deployment are not part of this editor change.
