# Vedøy Canvas

Vedøy Canvas er en visuell arbeidsflate for bøker, tavler, rammer, notater, design og nettsider. Målet er at kunder kan starte raskt uten konto, jobbe lokalt i nettleseren, og logge inn når de vil lagre prosjektet i skyen.

Produksjon: https://canvas.vedoystudio.no

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

## Kundeklar funksjonalitet

- én tydelig Vedøy-meny med bøker, tavler og nettsider
- bøker med sider, undersider, kategorier og rik tekst
- tavler basert på Excalidraw for fri tegning, notater, bilder, former og rammer
- rammer kan brukes som gjenbrukbare utsnitt og settes inn i bøker som levende klistremerker
- nettsider kan lages med samme designflater og genereres med OpenRouter når nøkkel finnes
- designbibliotek med ferdige maler for logo, Instagram-post, presentasjon og nettside-seksjon
- eksport til SVG, PNG, TXT, PDF, DOCX og PowerPoint
- import og eksport av `.excalidraw` og `.excalidrawlib`
- lokal lagring for gjester via `localStorage`
- innlogging og registrering via Vedøy Login, med Neon Postgres som identitetsdatabase
- innloggede arbeidsflater og bøker lagres gjennom Neon API-et på Vedøy Login
- gratiskvoter valideres på serveren: 2 bøker, 7 kategorier per bok og 10 sider per kategori
- Supporter Checkout bruker Stripe, men abonnement aktiveres først når en signert webhook bekrefter betaling

## Miljøvariabler

Legg disse inn lokalt og i Vercel:

```text
NEXT_PUBLIC_VEDOY_LOGIN_URL=https://vedoy-login.vercel.app
NEXT_PUBLIC_VEDOY_LOGIN_CLIENT_ID=
OPENROUTER_API_KEY=
```

`NEXT_PUBLIC_VEDOY_LOGIN_CLIENT_ID` må være klient-ID-en som registreres i Vedøy Login. Dersom API-et skal bruke en annen vert, kan `NEXT_PUBLIC_VEDOY_API_URL` settes eksplisitt; ellers peker det automatisk på Vedøy Login. `OPENROUTER_API_KEY` er en servervariabel og skal aldri ha `NEXT_PUBLIC_`-prefiks.

Stripe konfigureres bare på Vedøy Login-serveren, aldri i Canvas:

```text
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_SUPPORTER_PRICE_ID=
```

Stripe-prisen må være en aktiv NOK 19/måned-pris. Registrer webhooken på `/api/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` og `invoice.payment_failed`.

## Vercel-oppsett

I Vercel må miljøvariablene legges inn for Production, Preview og Development hvis alle miljøene skal fungere likt:

```text
NEXT_PUBLIC_VEDOY_LOGIN_URL
NEXT_PUBLIC_VEDOY_LOGIN_CLIENT_ID
OPENROUTER_API_KEY
```

Etter endring av miljøvariabler må Canvas deployes på nytt. Stripe-hemmelighetene legges bare til `vedoy-oauth`-prosjektet.

## Norsk backend videre

Canvas innlogging, OAuth, bøker og arbeidsflater bruker Neon i Frankfurt. Vedøy Credits bruker foreløpig eldre Supabase-tabeller og må migreres separat før hele Vedøy Login kan kalles Neon-only. Neon ligger i EU, men ikke i Norge.

- Go 1.22+
- PocketBase med embedded SQLite
- Caddy for HTTPS og reverse proxy
- Litestream/restic/borg for backup på norsk infrastruktur

Et SQLite-skjema for en egen norsk Vedøy-backend ligger i `sovereign/sqlite-schema.sql`.

## Begrensninger

Samarbeid synkroniserer hele prosjektet og bruker siste lagring som vinner. Det er ikke tegn-for-tegn-samskriving med konfliktfletting ennå. Eksisterende Supabase-kontoer og prosjektdata flyttes ikke automatisk.
