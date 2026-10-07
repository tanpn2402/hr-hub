---
name: hrhub-webapp
description: Build a small static web app (HTML/CSS/JS) for HR Hub that follows the HR Hub look and persists data through hrhub-sdk.js, then package it as a .zip ready to upload in HR Hub Admin > Apps > Web Apps. Use when asked to create, generate or modify an "HR Hub web app", form, tracker, calculator or report page for HR Hub.
---

# HR Hub web apps

An HR Hub web app is a **static site** (HTML + CSS + JS, no build step, no server code). An administrator
uploads it as `.zip` / `.tar.gz` in HR Hub, publishes it, and it opens at `/hr-hub/apps/<slug>`.
There is no backend of your own: you persist data through **`hrhub-sdk.js`** and style with **`hrhub-theme.css`**.

## Deliverable

A folder containing at least `index.html` **at its root**, packaged with `scripts/package.py`:

```
my-app/
  index.html     (required, at the root)
  app.js         (your logic; classic script, no modules/bundler needed)
  style.css      (only app-specific tweaks; the theme comes from hrhub-theme.css)
```

Run `python3 .claude/skills/hrhub-webapp/scripts/package.py my-app` → creates and validates `my-app.zip`.
Tell the user the slug to use (lowercase letters, digits, hyphens; 2-63 chars; not `api`, `assets`, `admin`,
`console`, `launch`, `web-apps`, `late-attendance`) and which **required roles** to set (none = public, anyone
can open and use it without logging in).

## Page skeleton (always start from this)

```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>App name</title>
    <link rel="stylesheet" href="/hr-hub/hrhub-theme.css" />
    <link rel="stylesheet" href="style.css" />
    <script src="/hr-hub/hrhub-sdk.js"></script>
  </head>
  <body>
    <div class="hh-page">
      <header class="hh-page-header">
        <div><h1>App name</h1><p class="hh-muted">One-line description</p></div>
        <div class="hh-row"><!-- primary actions --></div>
      </header>
      <main class="hh-page-body hh-container"><!-- content --></main>
    </div>
    <script src="app.js"></script>
  </body>
</html>
```

Use **relative** paths for your own files (`app.js`, `img/logo.svg`); use the two absolute `/hr-hub/...` URLs above
for the SDK and theme only. Default UI language is **Vietnamese** unless the user asks otherwise.

## The runtime: sandbox rules (read before coding)

The app runs inside a **sandboxed iframe with an opaque origin** so untrusted code can't touch the HR Hub session.
Therefore:

- **No `localStorage`, `sessionStorage`, cookies or IndexedDB** (they throw). Persist through `hrhub.data` only.
- **No direct calls to the HR Hub API** (`fetch('/hr-hub/api/...')` has no credentials). Use the SDK.
- Don't call third-party APIs with secrets; avoid external CDNs (apps should be self-contained; fonts/icons: inline
  SVG or emoji). Never put secrets in the code. Never use `eval`/`document.write`.
- Escape user text: use `textContent`, never `innerHTML` with data from the SDK or inputs.
- Allowed file types in the archive: html, htm, css, js, mjs, json, map, txt, md, xml, csv, svg, png, jpg, jpeg,
  gif, webp, avif, ico, woff, woff2, ttf, otf, webmanifest, wasm, mp3, mp4, webm, ogg, wav. No symlinks, no
  absolute or `../` paths. Limits: archive 50 MB, 2000 files, 20 MB per file, 200 MB extracted.
- One app is one page at `/hr-hub/apps/<slug>/`; there is no server routing, so do navigation/detail views
  inside `index.html` (show/hide sections), not with extra URLs.

## hrhub-sdk.js

Loaded from `/hr-hub/hrhub-sdk.js`; exposes `window.hrhub`. Every call returns a Promise. Errors are `Error`
objects with `.status` (`401` login needed, `403` no access, `404`, `409` conflict, `413` too large).

```js
// --- own data (a key/value store private to THIS app; values are any JSON, max ~1 MB) ---
await hrhub.data.set('settings', { theme: 'x' });          // -> { key, updatedAt }
const settings = await hrhub.data.get('settings');         // -> value, or null when missing
const entry = await hrhub.data.getEntry('settings');       // -> { key, value, updatedAt } or null
const keys = await hrhub.data.list();                      // -> [{ key, updatedAt }]
await hrhub.data.remove('settings');

// optimistic concurrency (avoid overwriting someone else's edit)
const e = await hrhub.data.getEntry('board');
await hrhub.data.set('board', newValue, { ifUpdatedAt: e ? e.updatedAt : 0 });  // 409 if changed meanwhile

// --- HR Hub employee directory (read-only; no email/phone) ---
const employees = await hrhub.employees.list();  // [{ id, employeeCode, name, department, position }]

// --- read ANOTHER app's data (read-only; user must be allowed to open that app) ---
const entries = await hrhub.apps.readData('other-app-slug');  // [{ key, value, updatedAt }]
```

Key rules: `^[A-Za-z0-9._:-]{1,128}$`, max 1000 keys per app, ~1 MB per value.

### Data modelling patterns

- **Append-only submissions** (forms): one key per record, e.g. `review:<code>:<timestamp>-<rand>`. Never read-modify-write
  a shared array for this: concurrent users would overwrite each other.
- **Small shared document** (settings, board): one key + `ifUpdatedAt`; on `409` reload and retry.
- **Reporting app**: a separate app that reads the form app via `hrhub.apps.readData(slug)`; sort/filter in JS.
- Store ISO timestamps (`new Date().toISOString()`), employee codes (not only names), and a `schemaVersion` if
  the shape may change.
- Anyone who can open the app can read its data through the API: don't store secrets or sensitive data in an app
  that is public or has broad roles. A form app and its reporting app should use different required roles when the
  results are sensitive (ask the administrator to restrict roles).

## Styling: follow HR Hub

Use `hrhub-theme.css` (HR Hub's real design tokens: green primary, neutral surfaces, Inter/system font, pill
buttons and inputs, rounded cards, small uppercase table headers). **Do not invent colours, fonts or shadows**;
use the CSS variables and `hh-*` classes. Keep `style.css` to layout tweaks only.

Tokens (CSS variables): `--background --foreground --card --primary --primary-foreground --secondary --muted
--muted-foreground --accent --destructive --success --warning --border --input --ring --radius-* --font-sans
--font-mono`. Dark mode is opt-in with `class="dark"` on `<html>`; HR Hub itself is light, so stay light.

| Need | Use |
|---|---|
| Page layout | `.hh-page` > `.hh-page-header` + `.hh-page-body` (`.hh-container` = max width) |
| Surface | `.hh-card` (add `.hh-card-clickable` for clickable tiles) |
| Buttons | `.hh-btn` (primary) `.hh-btn-outline` `.hh-btn-secondary` `.hh-btn-ghost` `.hh-btn-destructive`; sizes `-sm` `-xs` `-lg` |
| Form | `.hh-field` > `.hh-label` + `.hh-input` / `.hh-select` / `.hh-textarea`, `.hh-hint` for help text |
| Rating 1-5 | `.hh-scale` > `.hh-scale-item` (radio + span) |
| Data table | `.hh-table-wrap` > `table.hh-table` (`.hh-num` right-aligned numbers, `tr.hh-clickable`) |
| Status | `.hh-badge` `-secondary` `-outline` `-destructive` `-success` `-warning`, `.hh-dot` |
| Messages | `.hh-alert` `-error` `-success` `-info`; empty state `.hh-empty` |
| Progress | `.hh-bar > div[style=width:60%]` |
| Layout helpers | `.hh-stack` `.hh-row` `.hh-between` `.hh-grid` `.hh-grid-2` `.hh-muted` `.hh-mono` `.hh-hidden` |

Full snippets: `reference/components.md`. Working examples (copy their structure):
`webapps/employee-performance-review/` (form, submit-only) and `webapps/performance-review-result/`
(table + detail view, reads another app).

### UX conventions (match HR Hub)

- Title = `h1` in `.hh-page-header` with a muted one-line description; primary action top-right.
- Tables in a bordered rounded container; whole row clickable (also `Enter`/`Space`, `tabindex="0"`) when it opens detail.
- Always handle **loading** (`.hh-spinner` or text), **empty** (`.hh-empty`), **error** (`.hh-alert-error` with `error.message`).
- Disable the submit button while saving and until the form is valid; confirm success with `.hh-alert-success`.
- Numbers right-aligned (`.hh-num`); dates `toLocaleString('vi-VN')`; money `toLocaleString('vi-VN')` + ` ₫`.
- Responsive down to ~360 px (grids use `auto-fit`; tables scroll horizontally inside `.hh-table-wrap`).
- Accessible: real `<label for>`, buttons are `<button>`, visible focus (already in the theme), sufficient contrast.

## Workflow

1. Clarify: what data is captured/shown, who may use it (public or roles), whether it needs employees.
2. Create the folder from the skeleton; write `index.html`, `app.js`, optional `style.css`.
3. Persist only through `hrhub.data`; handle all SDK errors (show `error.message`).
4. Run `python3 .claude/skills/hrhub-webapp/scripts/package.py <folder>`; fix whatever it reports.
5. Give the user: the zip path, the suggested slug and name, the required roles, and what keys the app writes.
6. Upload: HR Hub → Apps → Web Apps → Create Web App (set name, slug, roles, choose the zip) — publishing makes it live;
   new versions: open the app → Upload new version → Publish (or Rollback to an older one).

## Checklist before handing over

- [ ] `index.html` at archive root; paths relative; SDK + theme linked with the absolute `/hr-hub/...` URLs
- [ ] No localStorage/cookies/direct API calls/eval/innerHTML with data; no external CDN
- [ ] Uses `hh-*` classes and theme variables only; no custom palette or font
- [ ] Loading, empty and error states; submit disabled while saving
- [ ] Data keys documented; one key per record for append-only data
- [ ] `package.py` passes
