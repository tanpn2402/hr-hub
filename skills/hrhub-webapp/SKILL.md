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
  hrhub.json     (always create one: name, description, slug, icon, settings; see "hrhub.json")
  favicon.svg    (always create one, at the root; see "Favicon, title and description")
  app.js         (your logic; classic script, no modules/bundler needed)
  style.css      (only app-specific tweaks; the theme comes from hrhub-theme.css)
```

Run `python3 .claude/skills/hrhub-webapp/scripts/package.py my-app` → creates and validates `my-app.zip`.
When the admin picks the zip in HR Hub, the form fills itself in from `hrhub.json` (name, description, slug, icon)
and shows the settings to enter. Still tell the user the slug to use (lowercase letters, digits, hyphens; 2-63 chars; not `api`, `assets`, `admin`,
`console`, `launch`, `web-apps`, `late-attendance`; `manage-app-accesses` is reserved for the access-request app), the **name** and one-line **description** to type in
HR Hub (they become the browser tab title and the app switcher text), and which **required roles** to set.

## Access model (decide this with the user)

- **No required roles = public**: anyone can open it, **without logging in**, and its data API works anonymously
  too (anyone can read and write that app's data). Good for open forms; not for anything sensitive.
- **Required roles** (e.g. `hr`; any one role is enough): visitors are sent to login first; users without the role
  get "no access", and the data API answers 401/403 for them. Enforcement is always **server-side**.
- **"Chỉ mình tôi" (only me)**: a checkbox next to the roles. Only the administrator who created the app can see,
  open, manage it and use its data API; everyone else, other administrators included, gets "not found", and the
  roles are ignored. Good for personal tools and drafts; the static files are still public (only data is protected).
  Only the creator can turn it on.
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

## hrhub.json: the app describes itself (always ship one)

```json
{
  "name": "Leave Report",
  "description": "Báo cáo đơn nghỉ phép theo phòng ban.",
  "slug": "leave-report",
  "icon": "favicon.svg",
  "settings": {
    "sourceApp": { "type": "app", "label": "App đơn nghỉ phép", "description": "App chứa các đơn cần báo cáo.", "required": true },
    "pageSize": { "type": "number", "label": "Số dòng mỗi trang", "default": 50, "min": 10, "max": 500 }
  }
}
```

- `name`, `description`, `slug` (suggested), `icon` (file at the root) **pre-fill the HR Hub form** on upload; the
  admin can still change name/description in HR Hub (those win; keep `<title>` in sync with them).
- `settings`: values the **administrator enters per app** (stored by HR Hub, kept across versions), shown as a form
  when the package is uploaded and on the app's page. Types: `app` (pick another web app → its slug), `string`,
  `text`, `number` (`min`/`max`), `boolean`, `select` (`options`: strings or `{ value, label }`). Each: `label`
  (required), `description`, `required`, `default`. Keys: letters/digits/_ starting with a letter.
- A `required` setting without a value blocks **publishing** (the app can be created as a draft first; this is how two
  apps that point at each other are installed: create A as a draft, create B pointing at A, fill A, publish A).
- **Never hard-code another app's slug.** Declare an `app` setting and use it:
  `hrhub.apps.readData({ setting: 'sourceApp' })`, `hrhub.realtime.join({ appSetting: 'hostApp', ... })`,
  `"participants": [{ "$setting": "playerApp" }]` in realtime channels, or read the slug from `hrhub.settings.get()`
  (e.g. to show "open /hr-hub/apps/<slug>").
- Settings are readable by the app's JS: **never put secrets** in them.
- A broken `hrhub.json` (bad JSON, unknown type, icon file missing...) is rejected on upload; `package.py` checks the
  same rules.

## Favicon, title and description

HR Hub shows each web app with **its own icon** in the app switcher, the admin list and the viewer's top bar, and,
while the app is open, the **browser tab** uses that icon, the app **name** as title and the **description** as
`<meta name="description">` (the HR Hub ones come back when the user leaves the app).

- **Icon**: HR Hub uses `hrhub.json` `"icon"`, else the first of `favicon.svg`, `favicon.png`, `favicon.ico` found **at
  the archive root** when a version is uploaded (uploading a version with a new file changes the icon). Always ship
  **`favicon.svg`**; add a PNG only when the user provides a raster logo.
- **Title / description** come from the **name** and **description** in HR Hub (pre-filled from `hrhub.json`), so put
  the same text in `<title>` and the page header and hand both to the user. Name: short (2-4 words, it is the tab
  title). Description: one sentence, under ~120 characters.

Drawing `favicon.svg` (you write it by hand; no external tools or images):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#16a34a"/>                         <!-- HR Hub green tile -->
  <path d="M20 18h18l8 8v20a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2V20a2 2 0 0 1 2-2z" fill="#fff"/>  <!-- one glyph -->
  <path d="M24 32h16M24 39h11" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>
</svg>
```

- `viewBox="0 0 64 64"`, a rounded tile filling the square (`rx` 12-16), **one** bold white glyph that says what the
  app does (form = document with lines, report = bars, calendar, people, laptop, checkmark, coin…), at most 2-3 shapes.
- It must read at **16 px**: no text except at most 1-2 big letters, no thin strokes (>= 3 at this scale), no shadows.
- Colour: HR Hub green `#16a34a` by default; to tell sibling apps apart use another solid Tailwind-600 tone
  (`#2563eb` blue, `#d97706` amber, `#9333ea` purple, `#e11d48` rose, `#0891b2` cyan) with the white glyph.
- Plain shapes only: no `<script>`, `<foreignObject>`, external `href`, embedded fonts or bitmaps; keep it < 2 KB.
- Link it in `index.html` (`<link rel="icon" href="favicon.svg" />`) so it also shows when the folder is opened on its own.

## Bigger apps: Preact + htm, still no build

For apps with several views (lists, details, tables with many columns) write **ES modules with Preact + htm** instead
of one long DOM-building script. There is no build and no npm: HR Hub serves the library at
`/hr-hub/vendor/hrhub-preact.module.js` (Preact 10, hooks, and `html` = htm bound to Preact, ~16 KB).
Working example: `webapps/performance-review-result-preact/`.

```
index.html   theme + sdk + ui links, <div id="app">, <script type="module" src="main.js">
lib.js       export * from '/hr-hub/vendor/hrhub-preact.module.js';   // the only place that knows the URL
rules.js / scoring.js   pure logic, no DOM and no Preact (testable with Node)
hooks.js     useRoute (hrhub.route), useResults (load data)
ui.js        small shared components (badges, Combobox wrapper around hrhub.ui.combobox)
list.js / detail.js / main.js   views and the router-by-state in <App/>
```

```js
import { html, render, useState, useEffect } from './lib.js';
const Row = ({ item, onOpen }) => html`<tr class="hh-clickable" onClick=${() => onOpen(item)}><td>${item.name}</td></tr>`;
render(html`<${App} />`, document.getElementById('app'));      // components: <${Comp} prop=${x} /> ; fragments: <${Fragment}>…<//>
```

Rules: plain `.js` modules with relative imports (include the extension); text in `${}` is escaped for you (never
use `innerHTML`); use `class=` (not className) and `colSpan="2"`; do **not** use browser history/`BrowserRouter` (sandbox):
derive the view from `hrhub.route` in a hook; wrap `hrhub.ui.*` widgets (imperative) in a component with a ref and
effects. Use `hrhub-theme.css` classes as before. Keep scoring/business rules in pure modules and test them in Node.

## Shared libraries in /hr-hub/vendor/ (no npm, no CDN)

HR Hub serves a few ES modules to apps (CORS enabled for the sandboxed iframe). Import them with absolute URLs from
`<script type="module">` code, ideally re-exported from one `lib.js`:

| Module | What | Use |
|---|---|---|
| `/hr-hub/vendor/hrhub-preact.module.js` | Preact 10 + hooks + `html` (htm) | multi-view apps (see above) |
| `/hr-hub/vendor/hrhub-motion.module.js` | Motion vanilla API: `animate`, `spring`, `stagger`, `inView`, `scroll`, `delay` | lively UI: `animate(el, { scale: [0.3, 1] }, { type: spring, bounce: 0.5 })`; number count-ups `animate(0, 900, { onUpdate })`. Respect `prefers-reduced-motion`. |
| `/hr-hub/vendor/hrhub-guard.module.js` | `watchDevtools({ onChange, interval, threshold, blockShortcuts, contextMenu })` → `{ isOpen(), stop() }`; `blockShortcuts({ contextMenu })` → undo | games/quizzes that want to deter the curious: pauses on DevTools, swallows F12 / Ctrl+Shift+I/J/C / Ctrl+U / right click. **A deterrent only**: never rely on it for security; keep secrets and answers off the device. |

Rebuild `hrhub-motion.module.js` after upgrading `motion`: `node scripts/build-vendor-motion.mjs`.

## Page skeleton (always start from this)

```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>App name</title>
    <meta name="description" content="One-line description" />
    <link rel="icon" href="favicon.svg" />
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
await hrhub.user.login();            // visitor of a public app: sign in, then return to this exact page
await hrhub.user.logout();           // end the session, then return to this exact page
// roles = realm + client roles; groups only when the identity provider releases a "groups" claim (else []).
// Use it for UI only (greeting, hiding buttons): real access control is enforced by the server, never by app JS.

// --- HR Hub employee directory (read-only; no email/phone; available to anonymous visitors of public apps too) ---
const employees = await hrhub.employees.list();  // [{ id, employeeCode, name, email, department, position }] (active only)
// department is a COMMA LIST: main department first, then teams, e.g. "dev,dev_api,dev_web" (a dev in the api and web
// teams). Never compare the whole string: split on ',' and trim. position is free text (member, leader, manager, ...).

// --- read ANOTHER app's data (read-only; user must be allowed to open that app) ---
const entries = await hrhub.apps.readData({ setting: 'sourceApp' });  // [{ key, value, updatedAt }] of the app chosen in an "app" setting
// (hrhub.apps.readData('slug') also works, but do not hard-code other apps' slugs: declare a setting)

// --- settings (hrhub.json "settings", filled in by the administrator per app; cached) ---
const settings = await hrhub.settings.get();     // { sourceApp: 'leave-requests', pageSize: 50 }  (defaults included)
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
- **Reporting app**: a separate app that reads the form app via an `app` setting (`hrhub.apps.readData({ setting })`);
  sort/filter in JS.
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

### Employees, departments and who-reviewed-whom

- Parse `department` into a list (`d.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)`). "Is a dev" means
  the list **contains** `dev`; "shares a team" means the lists overlap (`dev_api` in both). Weighting by shared
  department is done by counting the overlap.
- To know the **signed-in user's own employee record**, match `me` against `hrhub.employees.list()` inside the app:
  by `email` (case-insensitive), else `employeeCode === me.username`, else every part of a dotted username
  (`tan.pham`) appears in the normalized employee name (strip diacritics); accept only a **unique** match, otherwise
  treat the department as unknown. Example: `webapps/employee-performance-review/app.js` (`findMyEmployee`).
- When a rule depends on the reviewer's department, store `employeeCode`/`department`/`position` of the reviewer in the
  record at submit time; the roles and department a record carries are self-reported by the app, only
  `createdBy`/`createdAt` are authoritative.

### Using the logged-in user

HR Hub's own top bar (above every app) already shows the **signed-in user at the top right** (name, e-mail, a menu with
**logout**) or a **login** button for visitors of public apps. Do not draw a second login/logout UI; add an
in-app badge only when it shows extra details (department, roles) and, if you offer a logout button, call
`hrhub.user.logout()` (it returns the user to the same URL after signing out).

`hrhub.user.get()` is for **display and UX only** (greeting, pre-filling a "reviewer" field, hiding buttons the user
can't use, e.g. `if (me.roles.some((r) => r.toLowerCase() === 'hr'))`). Never rely on it for security: the
sandboxed JS can be tampered with, so anything that must be restricted needs the app's **required roles** instead.
Handle `me.authenticated === false` (public apps), and treat `groups` as optional (usually `[]` today). Store
`me.username`/`me.id` with a record when you need to know who submitted it.

## Realtime: live apps with channels (quizzes, polls, check-ins)

For anything live (Kahoot-style quiz, live poll, Q&A, lucky draw, planning poker) use **channels**. A channel belongs
to the app that opens it: that app's user is the **host**. Other apps declared in its `hrhub.json` (or the same app)
**join** as **participants**. Participants only ever talk to the host; the host decides what everybody sees.
Working example: `webapps/quizzy-admin/` (host: `host.js`) + `webapps/quizzy/` (players: `main.js`).

### Typical layout: two apps

- **Owner app** (e.g. `quizzy-admin`, restricted roles): authoring, data, hosting. Ships `hrhub.json`.
- **Participant app** (e.g. `quizzy`, often public): enter a code, join, play. Needs no manifest.
- One app can also be both (host and participants in the same app) for simple cases.

### hrhub.json (owner app, archive root): declares the channels

```json
{
  "realtime": {
    "channels": [
      { "prefix": "event:", "participants": [{ "$setting": "playerApp" }], "hostRoles": [], "maxParticipants": 500,
        "allowAnonymous": true, "presenceVisible": false, "hostGraceSeconds": 600 }
    ]
  }
}
```

- `prefix`: channel names starting with it (`event:K7M2QX`); longest matching prefix wins; `""` = any name.
- `participants`: other apps allowed to join (the owner app may always join its own channels): preferably
  `{ "$setting": "<app setting>" }` (the app the admin chose), or a fixed slug.
- `hostRoles`: roles allowed to open (host) these channels; `[]` = anyone who may open the owner app.
- `maxParticipants` (default 200, max 2000), `allowAnonymous` (visitors of a public participant app, with a
  nickname), `presenceVisible` (participants see who else is in; the host always does), `hostGraceSeconds` (how long a
  channel survives its host going offline, default 300).
- An invalid `hrhub.json` is **rejected on upload**. No manifest = no channels. Only the published version counts.

### SDK (`hrhub.realtime`)

```js
// host (owner app)
const ch = await hrhub.realtime.open('event:K7M2QX');           // reopening the same name after a reload re-attaches
ch.onPresence((p) => ...);       // { hostOnline, count, online, participants: [{ id, name, username, anonymous, app, online, ip }] }
ch.on('answer', (payload, meta) => ...);   // meta = { from: { id, name, anonymous, app }, at }  (server-stamped, unforgeable)
ch.on('*', (payload, meta, type) => ...);
const { at } = await ch.setState({ phase: 'question', idx: 0 });  // retained: late joiners/reconnects get it at once
await ch.broadcast('reveal', { correct: 2 });                      // everyone, not retained
await ch.sendTo([memberId], 'note', { ... });                      // same payload to some
await ch.sendEach('me', { [idA]: { score: 900 }, [idB]: { score: 450 } });   // own payload each, ONE call
ch.onLatency((pings, hostMs) => ...);      // { memberId: ms } every ~5 s (measured by the server)
await ch.putAsset('img:q1', dataUrl);      // share something bigger than a message (<= 256 KB, 4 MB / 200 per channel) once
await ch.kick(memberId);                   // removed and cannot rejoin
await ch.close();

// participant (another app, or the same one)
const ch = await hrhub.realtime.join({ appSetting: 'hostApp', channel: 'event:K7M2QX', nickname: 'An' });   // or app: '<slug>'
ch.onState((state) => render(state));     // called at once with the current state, then on every change
ch.on('me', (payload) => ...);            // messages from the host
const dataUrl = await ch.getAsset('img:q1');   // fetch a host asset when needed (cached per key)
await ch.send('answer', { idx: 0, choice: 2 }, { persist: 'q0' });   // ONLY to the host; persist = also saved
ch.onClose((reason) => ...);              // 'closed' | 'host_left' | 'kicked'
await ch.leave();

hrhub.realtime.now();                     // server clock estimate (ms): count down to server times, not Date.now()
hrhub.realtime.ping(); hrhub.realtime.onPing((ms) => ...);   // this device's ping
hrhub.realtime.onStatus(({ connected }) => ...);             // reconnects (and rejoins) are automatic
```

Errors carry `error.code`: `not_found` (no such open channel / no manifest rule), `forbidden`, `login_required`,
`full`, `in_use` (another host), `nickname_taken`, `too_large`, `rate_limited`, `bad_request`.
Names and message types: letters, digits, `. _ : -` (max 64). Limits: message 16 KB, state 64 KB, ~20 events/s per
device (bursts of 40). Nickname required for anonymous members (max 40), unique per channel.

### Rules that keep it fair (design every live app this way)

- **The host is the referee.** Scoring, timing and "who won" are computed in the host's browser from `meta.at`
  (server time) and `meta.from` (server identity), never from anything a participant claims. Use the `at` returned
  by `setState` as the start time of a timed phase.
- **Never send what players must not see yet.** Correct answers go out at reveal time, not with the question. Keep
  the answer key in the owner app's data (players' app cannot read another app's data unless they may open it, so the
  owner app must have restricted roles). Offer a "question only on the main screen" mode (no text sent at all) when
  bots/AI are a concern.
- **Persist what matters**: `send(..., { persist: id })` makes the server store it in the OWNER app's data as
  `rt:<channel name>:<member id>` = `{ channel, participant, items: { <id>: { type, payload, at } } }` (one record per
  member; resending an id replaces it). The host also checkpoints its own progress with `hrhub.data.set` so a reload
  can resume (channels survive `hostGraceSeconds` without the host). Mind the 1000-keys-per-app limit.
- **Batch per-player replies** with `sendEach` (one call), never a `sendTo` loop (rate limit).
- **Images and other big content**: never put them in state or messages (64 KB / 16 KB). The host `putAsset`s them
  once (e.g. while players wait in the lobby) and sends only the key in the state; players `getAsset(key)`. Do not
  share what players must not see (e.g. skip the upload when questions stay on the main screen).
- **Presence lags a little** (~250 ms, batched): seat a player from `meta.from` on their first message.
- **Players reconnect transparently** (same identity: user id, or a signed anonymous token for visitors); on join send
  a `hello` and let the host answer with that player's current situation.
- Channels live in the API's memory: a server restart closes them (the app should recover from its saved data).
- For a deterrent against curious players opening DevTools, use `/hr-hub/vendor/hrhub-guard.module.js` (see above);
  it is not security.

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
| Searchable select / dialog / checkbox | `hrhub.ui.combobox/dialog/alert/confirm/checkbox` from `/hr-hub/hrhub-ui.js` (load after the SDK), never native `<select>`/`<input type=checkbox>`/`alert()`; see `reference/components.md` |
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
- Long forms: keep the submit button together with the running total in a **sticky bar at the bottom** of the form
  (`position: sticky; bottom: .75rem`, card background, border, shadow), and give free-text fields such as a general
  comment their own card above it.
- Show `department` (comma list) and `position` as **badges** (`hh-badge-outline` per department entry,
  `hh-badge-secondary` for the position), not as plain text, and keep dropdown option text short (name and code).
- Disable the submit button while saving and until the form is valid; confirm success with `.hh-alert-success`.
- Numbers right-aligned (`.hh-num`); dates `toLocaleString('vi-VN')`; money `toLocaleString('vi-VN')` + ` ₫`.
- Responsive down to ~360 px (grids use `auto-fit`; tables scroll horizontally inside `.hh-table-wrap`).
- Accessible: real `<label for>`, buttons are `<button>`, visible focus (already in the theme), sufficient contrast.

## Workflow

1. Clarify: what data is captured/shown, who may use it (public or roles), whether it needs employees.
2. Create the folder from the skeleton; write `index.html`, `favicon.svg`, `app.js`, optional `style.css`.
3. Persist only through `hrhub.data`; handle all SDK errors (show `error.message`).
4. Run `python3 .claude/skills/hrhub-webapp/scripts/package.py <folder>`; fix whatever it reports.
5. Give the user: the zip path, the suggested slug, name and description, the access (roles, public or "Chỉ mình tôi"),
   and what keys the app writes.
6. Upload: HR Hub → Apps → Web Apps → Create Web App (set name, slug, description, roles, choose the zip) — publishing makes it live;
   new versions: open the app → Upload new version → Publish (or Rollback to an older one).

## Checklist before handing over

- [ ] `index.html` at archive root; paths relative; SDK + theme linked with the absolute `/hr-hub/...` URLs
- [ ] `favicon.svg` at the root (tile + one glyph, readable at 16 px) and linked; `<title>` = app name, meta description set
- [ ] No localStorage/cookies/direct API calls/eval/innerHTML with data; no external CDN
- [ ] Uses `hh-*` classes and theme variables only; no custom palette or font
- [ ] Loading, empty and error states; submit disabled while saving
- [ ] Data keys documented; one key per record for append-only data
- [ ] List/detail apps use `hrhub.route` (deep-linkable detail URL, back button works)
- [ ] Delete UI handles `403` (not creator / not admin); audit info comes from `createdBy`/`updatedBy`, not app JS
- [ ] Access decided with the user (public, required roles or "Chỉ mình tôi") and stated in the handover with name + description
- [ ] `hrhub.user.get()` used for display only; handles anonymous visitors
- [ ] `hrhub.json` with name, description, slug, icon; no other app's slug hard-coded (use `app` settings)
- [ ] Live apps: `hrhub.json` in the owner app, participants listed, host scores from `meta.at`/`meta.from`, no answers sent before reveal
- [ ] `package.py` passes
