# Design capabilities and release limits

Reviewed 2026-09-30 against the installed package manifest and official documentation.

## Included

- Excalidraw 0.18: editable vector shapes, arrows, free drawing, frames, images, personal libraries and scene export. https://docs.excalidraw.com/
- React and Next.js: application, client editor and server endpoints. https://react.dev/ and https://nextjs.org/docs
- Lucide: interface icons. https://lucide.dev/
- docx and jsPDF: document exports. https://docx.js.org/ and https://github.com/parallax/jsPDF
- Local upload collection: IndexedDB; PNG/JPEG/WebP/GIF, 10 MB/file, 40 megapixels, transactional saves and visible failures.
- Original starter graphics and four editable standard components. These are canvas drawings, not interactive website controls.
- Book typography: system font suggestions plus manually entered installed font families, bold/italic/underline, RGB text/highlight colors, optional browser EyeDropper.

## Evaluated, not installed

- Tiptap: structured document editing and font/color extensions; an appropriate candidate to replace legacy execCommand. Its documentation distinguishes open-source extensions from commercial plans; do not assume every feature is free. https://tiptap.dev/docs/editor/extensions/overview
- Fabric.js: object-based design and richer typography; suitable for a separate precision-design surface if required. Adding another drawing engine to the existing Excalidraw state requires an explicit interoperability model. https://www.fabricjs.com/docs/core-concepts/

## Remaining release gates

This is not feature-equivalent to Canva and is not certified production-ready.

1. Verify Vedøy OAuth end-to-end with the actual configured client and redirect URI. Production login currently needs further diagnosis.
2. Reconcile the missing Vedøy REST backend configuration with remaining Supabase configuration. Verify user-scoped storage, authorization, token renewal, account deletion and backup restore before advertising cloud backup.
3. Replace local-only asset persistence with user-scoped object storage, quota enforcement, content validation and cleanup. Local browser data is shared by local users and can be removed by browser cleanup.
4. Add multi-user/concurrency tests, rate limits and timeouts on generation, monitoring, restore tests and load tests before scalability claims.
5. Precision logos, font-file uploads, template marketplace, background removal, video editing, animation export and real-time collaboration remain outside the implemented editor.
6. Review complete privacy/cookie information against actual production data flows before describing the guidelines as a complete legal policy.

## Verification for this change

- TypeScript check and optimized production build, with type errors no longer ignored.
- Browser verified the design library tabs and import of Knapp, Kort, Etikett and Tekstfelt into the native personal library.
- Further interaction and deployment verification is recorded in the task, not implied by this document.
