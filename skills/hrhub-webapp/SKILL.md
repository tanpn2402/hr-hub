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
`console`, `launch`, `web-apps`, `late-attendance`; `manage-app-accesses` is reserved for the access-request app) and which **required roles** to set.

## Access model (decide this with the user)

- **No required roles = public**: anyone can open it, **without logging in**, and its data API works anonymously
  too (anyone can read and write that app's data). Good for open forms; not for anything sensitive.
- **Required roles** (e.g. `hr`; any one role is enough): visitors are sent to login first; users without the role
  get "no access", and the data API answers 401/403 for them. Enforcement is always **server-side**.
- Role names are case-insensitive in the HR Hub portal itself, but for web apps use the exact Idenplane role name.
- A signed-in user **without the role** does not see the app: HR Hub shows a screen with the app's info, a
  "Yêu cầu quyền truy cập" button and a sign-out button. The request is only a **notification**: HR Hub writes it
  into the data of the normal web app **`manage-app-accesses`** (key `request:<slug>:<userId>`, statuses `pending` /
  `approved` / `rejected`) so administrators see who is asking. It never changes who can open an app: **roles are
  granted in Idenplane Admin**, and the administrator then marks the request as handled in that app. The requester
  must sign out and in again to receive a new role.
- `manage-app-accesses` is an ordinary web app (`webapps/manage-app-accesses`): create it once with the slug
  `manage-app-accesses` and give it the administrators' roles. Its slug is the one the request button writes to, so
  do not use it for anything else. If it is missing, the button reports that requests are not set up.
- A reporting app that reads a form app's data should get **restricted roles**, but the form app's data is still
  readable by anyone allowed to open the form app. For sensitive results ask the admin to restrict the form app too.

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
objects with `.status` (`403` no access, `404`, `409` conflict, `413` too large). A `401` makes the viewer send the
visitor to login and bring them back, so apps normally never see it.

```js
// --- own data (a key/value store private to THIS app; values are any JSON, max ~1 MB) ---
await hrhub.data.set('settings', { theme: 'x' });          // -> { key, updatedAt }
const settings = await hrhub.data.get('settings');         // -> value, or null when missing
const entry = await hrhub.data.getEntry('settings');       // -> { key, value, updatedAt } or null
const keys = await hrhub.data.list();                      // -> [{ key, updatedAt }]
const all = await hrhub.data.all();                        // -> [{ key, value, updatedAt, createdAt, createdBy, updatedBy }] (batch-fetched)
await hrhub.data.remove('settings');                       // SOFT delete (state X); creator or admin only, else 403

// optimistic concurrency (avoid overwriting someone else's edit)
const e = await hrhub.data.getEntry('board');
await hrhub.data.set('board', newValue, { ifUpdatedAt: e ? e.updatedAt : 0 });  // 409 if changed meanwhile

// --- sub-routes: every app has its own URLs /hr-hub/apps/<slug>/<path> (deep links, browser back) ---
const path = await hrhub.route.get();            // '' | 'list' | 'review:517:...'  (the part after the slug)
await hrhub.route.navigate('review:517:abc');    // pushes /hr-hub/apps/<slug>/review:517:abc
await hrhub.route.back('list');                  // history back, or go to the fallback when entered directly
const off = hrhub.route.onChange((path) => render(path));   // fires on navigate, back and forward

// --- logged-in user (no tokens; anonymous visitors get authenticated:false) ---
const me = await hrhub.user.get();   // { authenticated, id, username, name, email, roles: [], groups: [] }
// roles = realm + client roles; groups only when the identity provider releases a "groups" claim (else []).
// Use it for UI only (greeting, hiding buttons): real access control is enforced by the server, never by app JS.

// --- HR Hub employee directory (read-only; no email/phone; available to anonymous visitors of public apps too) ---
const employees = await hrhub.employees.list();  // [{ id, employeeCode, name, department, position }]

// --- read ANOTHER app's data (read-only; user must be allowed to open that app) ---
const entries = await hrhub.apps.readData('other-app-slug');  // [{ key, value, updatedAt }]
```

Key rules: `^[A-Za-z0-9._:-]{1,128}$`, max 1000 active keys per app, ~1 MB per value.

### Audit, soft delete and client IP (done by the platform)

- Every record has `createdAt`, `createdBy`, `updatedAt`, `updatedBy` (`"username <email>"`, or `null` when an anonymous
  visitor of a public app wrote it). Use them instead of inventing `author` fields; they come from the session, not
  from your JS, so they cannot be forged. Writing over an existing key records the editor in `updatedBy`.
- **Delete is soft**: `remove()` sets the record to state `X`; reads (`get`, `list`, `all`) only return active (`A`)
  records. Writing the same key again creates a new record. Only the **creator or an administrator** may delete
  (`403` otherwise); records created anonymously can only be deleted by administrators. Show the delete button only
  to the creator (`record.createdBy` vs the current user) and still handle a `403`.
- **Client IP**: on every write the API records the client IP it receives in the headers nginx forwards
  (`X-Real-IP`) next to `createdBy`/`updatedBy`, for auditing. Apps do not look up or send an IP, and must not call IP
  lookup services.

### Data modelling patterns

- **Append-only submissions** (forms): one key per record, e.g. `review:<code>:<timestamp>-<rand>`. Never read-modify-write
  a shared array for this: concurrent users would overwrite each other.
- **Small shared document** (settings, board): one key + `ifUpdatedAt`; on `409` reload and retry.
- **"My records" list inside a form app**: `hrhub.data.all()`, then filter client-side by the record's `createdBy`
  (or by a `reviewer.id` you stored). This is a UX filter only: the data API returns every record to anyone who can
  open the app. Delete with `hrhub.data.remove(entry.key)` (soft delete, creator or admin) and keep the entry `key`
  from `all()` for it.
- **Reporting app**: a separate app that reads the form app via `hrhub.apps.readData(slug)`; sort/filter in JS.
- Store ISO timestamps (`new Date().toISOString()`), employee codes (not only names), and a `schemaVersion` if
  the shape may change.
- Anyone who can open the app can read its data through the API (anonymous visitors too when it is public): don't
  store secrets or sensitive data in an app that is public or has broad roles. A form app and its reporting app should use different required roles when the
  results are sensitive (ask the administrator to restrict roles).

### Sub-routes (list → detail)

Apps with a list and a detail view **must use sub-routes** so each record has a shareable URL and the browser back
button works. Convention: `''` = main view, `'list'` = list (when the main view is a form), anything else = a record:

```js
function applyRoute(path) {
  if (path === '') return showMain();
  if (path === 'list') return showList();
  return showDetail(path);                       // path = record key, e.g. "review:517:1791372641284-yxfwxj"
}
hrhub.route.get().then(applyRoute);              // initial URL (deep link)
hrhub.route.onChange(applyRoute);                // navigate / back / forward
row.onclick = () => hrhub.route.navigate(entry.key);          // -> /hr-hub/apps/<slug>/<key>
backBtn.onclick = () => hrhub.route.back('list');             // fallback when opened directly on the detail URL
```

Do not use `location`, `history` or `#hash` for this (the app is sandboxed). Load the record from the route
(`hrhub.data.getEntry(key)`) instead of relying on a list loaded earlier, handle "not found" (null), and keep keys URL
friendly. Do not use dots in keys or path segments: the dev server treats a path with a dot as a file.

### Using the logged-in user

`hrhub.user.get()` is for **display and UX only** (greeting, pre-filling a "reviewer" field, hiding buttons the user
can't use, e.g. `if (me.roles.some((r) => r.toLowerCase() === 'hr'))`). Never rely on it for security: the
sandboxed JS can be tampered with, so anything that must be restricted needs the app's **required roles** instead.
Handle `me.authenticated === false` (public apps), and treat `groups` as optional (usually `[]` today). Store
`me.username`/`me.id` with a record when you need to know who submitted it.

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
- [ ] List/detail apps use `hrhub.route` (deep-linkable detail URL, back button works)
- [ ] Delete UI handles `403` (not creator / not admin); audit info comes from `createdBy`/`updatedBy`, not app JS
- [ ] Access decided with the user (public vs required roles) and stated in the handover
- [ ] `hrhub.user.get()` used for display only; handles anonymous visitors
- [ ] `package.py` passes
