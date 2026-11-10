# Vedøy Infinite Canvas

**Think. Plan. Design. Create. Document. Build. One canvas. Infinite possibilities. ✨**

Vedøy Infinite Canvas is a shared workspace for documentation, books, infinite whiteboards, reusable components and development workflows.

## Lokal bruk

```bash
npm install
npm run dev
```

Åpne `http://localhost:3000`.

## Bygg

```bash
npm run build
```

Produksjon: https://vedoy-canvas.vercel.app

## Status

Canvaset har én samlet Vedøy-meny og støtter:

- utvalg, hånd, former, pil, linje, frihånd, tekst, bilde og viskelær
- rammer, innebygd nettinnhold og laserpeker
- angre/gjør om, zoom og Excalidraw sin høyreklikkmeny
- bibliotek, import og eksport av `.excalidrawlib`
- åpning og lagring av `.excalidraw`
- eksport som SVG, PNG, TXT og PDF samt kopiering av PNG
- DOCX-eksport for Word og kompatibel import i Google Docs og Proton Docs
- lyst/mørkt tema og responsiv «Mer»-meny
- separate canvases for each page, with books, subfolders and subfiles
- rich text with headings, lists, checkboxes, links and embedded images
- canvas previews inserted directly between paragraphs and reopened in Canvas view for editing
- global search across page text, book titles and text elements inside canvases
- reusable templates for customer meetings, project plans, idea books and weekly plans
- per-book invitations and collaborative editing through Supabase Realtime
- renaming, drag-and-drop reordering, favorites and deletion in the navigator
- Vedøy Login og lagring av brukerens canvas i Supabase-tabellen `canvas_documents`

Gruppering, lagrekkefølge, justering, duplisering og «legg til i bibliotek» finnes i høyreklikkmenyen når elementer er valgt.

## Backend

Følgende offentlige miljøvariabler må finnes lokalt og i Vercel:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_VEDOY_LOGIN_CLIENT_ID=
```

`canvas_documents` må ha Row Level Security slik at en innlogget bruker bare kan lese og endre raden hvor `user_id = auth.uid()`. Kjør også migrasjonen i `supabase/migrations` for `canvas_books` og `canvas_book_members`; den aktiverer RLS, eier-/medlemspolicyer og Realtime for delte bøker. Aldri legg en Supabase service-role-nøkkel i klienten.

## Avgrensning

Samarbeid synkroniserer hele boken og bruker «siste lagring vinner». Det er ikke tegn-for-tegn-samskriving med konfliktfletting. Bilder under 2 MB lagres som en del av bokdataene; større mediebibliotek bør senere flyttes til en privat Supabase Storage-bucket.


## Platform direction

Vedøy Infinite Canvas is designed as a standalone product that also plugs into the wider Vedøy developer platform.

- **Vedoy ID**: one account across Vedøy services.
- **Developer Projects**: open Canvas with `?project=<developer_project_uuid>` to use a project-scoped workspace.
- **My Library**: reusable components and assets stored at account level.
- **Vedoy Marketplace**: public My Library assets can be discovered and copied into a personal library. Paid Vedoy Coin installs are intentionally not enabled yet.
- **Forge**: planned build/runtime integration for turning Canvas structures into working projects.
- **VedoyScript + Polyglot**: planned language/runtime layer for mixed frontend/backend project execution.

Project-scoped workspaces reuse `developer_projects`; Canvas does not create a parallel project registry.

## Current limitations / next phase

- Realtime collaboration still uses whole-book last-write-wins rather than CRDT/character-level merge.
- My Library currently supports Canvas/Excalidraw component packs first; other asset kinds need dedicated import/use adapters.
- Marketplace publishing is available for free public assets. Paid installs need a reviewed Vedoy Coins transaction flow, entitlement ledger and refund rules before activation.
- Forge, VedoyScript and Polyglot are platform integrations, not yet a complete runtime inside Canvas.
- Large media should move from JSON payloads to private Supabase Storage.
- `app/page.tsx` remains large and should be split into workspace, sync, library, navigation and project modules before the next major feature wave.


## Canvas AI — OpenAI + Vedoy Rewards (feature PR; not active in production)

The optional Canvas AI panel uses an internal Vedoy ID session, an allowlisted
OpenAI model selector sorted newest-first using the provider's model creation
timestamps, and the existing Vedoy Rewards Coin ledger.

**Required server-side environment variables, once approved:**

```text
OPENAI_API_KEY=                 # Secret OpenAI project API key
SUPABASE_SERVICE_ROLE_KEY=      # Server only; same shared Supabase project as Rewards
VEDOY_COINS_PER_USD=           # Explicitly approved conversion ratio, e.g. 100 Coins / USD
```

The above example ratio is illustrative and **not** a claim about the current
cash value of Vedoy Coins. If the key, the conversion ratio, or the database
payment RPCs are absent, Canvas AI is not able to charge Coins. Do not
configure a numeric rate until Vedoy has decided and documented its commercial
and legal terms. Keep all secrets outside the browser; never prefix them with
`NEXT_PUBLIC_`.

How the payment flow works:
1. The server verifies the user's Supabase session and active internal Canvas
   membership. The client never calls OpenAI or the privileged ledger directly.
2. The server lists only models the OpenAI account exposes **and** whose
   text-token prices have been manually reviewed in `lib/canvas-ai-config.ts`.
   Prices are short-context **Standard** API token rates only. Long-context,
   regional processing, web search and additional priced tools are not enabled.
3. The user explicitly requests a Coin quote. A conservative maximum
   reservation covers prompt UTF-8 size, fixed instructions and the response cap.
4. The user approves the maximum Coin amount. A server-only atomic Rewards RPC
   checks the balance and reserves Coins; a failure stops the OpenAI call.
5. Usage from the OpenAI Responses API determines the final charge.
   A 50% **markup** is applied and Coins are rounded up; unused reserved Coins
   are refunded atomically via another RPC. Failed provider calls trigger a
   full cancellation/refund attempt.

**Deployment dependency:** The companion migration is in
`leandervedoy/vedoy-rewards`, branch `feat/canvas-ai-coin-billing`.
Do not merge, enable or deploy payment until the Rewards database migration
has been reviewed and tested with isolated test data. Confirm idempotent
settlement, concurrent reservations, refunds, RLS and incident recovery.
The UI sends **only submitted text** (or user-selected Excalidraw text) to
OpenAI, with `store: false`. Chat transcripts are not automatically persisted.

Run `npx tsc --noEmit` and
`node --experimental-strip-types --test tests/canvas-ai-pricing.test.mjs`
with Node 24. The repo currently has
`typescript.ignoreBuildErrors: true`, so a passing Next.js build alone
is **not** proof of type safety. A dedicated GitHub Actions check was added.

The price list may become outdated: verify
https://platform.openai.com/pricing before enabling real payments or offering
new models. No automatic repricing from an untrusted public webpage.
