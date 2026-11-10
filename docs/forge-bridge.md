# Forge integration bridge

Canvas and Forge remain separate repositories, apps and deployments.

The browser editor responds to a one-way on-demand project export from a verified parent Forge window. It sends `index.html`, `styles.css`, `script.js` only to an explicitly allowed parent origin.

## Setup
Set `NEXT_PUBLIC_FORGE_ORIGINS` in the Canvas Vercel project to the exact HTTPS origin where Forge is hosted, for example `https://forge.vedoystudio.no`. Multiple origins can be comma-separated. Redeploy Canvas after changing the public build-time environment variable. Do not use `*` or a suffix wildcard.

In Forge, set `NEXT_PUBLIC_FORGE_CANVAS_URL` to the deployed URL of this bridge-equipped Canvas branch. It must have HTTPS. Make sure Canvas's `frame-ancestors` policy allows the Forge origin.

After both versions are deployed, open Forge at `/forge/canvas`, edit the Canvas project and click **Import project**. The files are imported into Forge local storage and previewed without modifying VedoyScript source.

The deployment at `https://vedoy-canvas-3sj8eknyo-vedoy.vercel.app/` predates this bridge and will not support importing until replaced with a bridge-equipped deployment.

### Security boundaries
No postMessage wildcard targets; parent origin and source validated, fixed protocol version and 256 KiB maximum source content. The iframe export never includes auth tokens, Supabase credentials, or private notebook content. Do not embed Canvas in untrusted origins. This is an editor integration, not synchronized multi-user storage.
