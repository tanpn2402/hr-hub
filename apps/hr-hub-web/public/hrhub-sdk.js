/*!
 * HR Hub Web App SDK
 *
 * Include in your app's index.html:
 *   <script src="/hr-hub/hrhub-sdk.js"></script>
 *
 * Apps run in a sandboxed iframe (no localStorage / cookies / direct API access). Persist data through:
 *   await hrhub.data.set('employees', [{ id: '001', name: 'Peter' }]);
 *   const employees = await hrhub.data.get('employees');   // value, or null when missing
 *   const everything = await hrhub.data.all();             // [{ key, value, updatedAt }] all records of this app
 *   const keys = await hrhub.data.list();                  // [{ key, updatedAt }]
 *   await hrhub.data.remove('employees');                  // soft delete (state X): creator or admin only
 *
 * Every record returned by get/getEntry/list/all also carries audit info:
 *   { key, value, updatedAt, createdAt, createdBy, updatedBy }   // createdBy/updatedBy: "username <email>" or null
 * Records are never physically deleted: remove() marks them deleted (state X) and reads only return active ones.
 * Only the creator or an administrator may delete a record (403 otherwise); anonymous records: administrators only.
 * Writes are also audited with the client IP, which the API takes from the headers nginx forwards: apps do
 * not need to do anything.
 *
 * Sub-routes: each app has its own URLs /hr-hub/apps/<slug>/<path> (deep links, back button):
 *   const path = await hrhub.route.get();               // '' | 'list' | 'review:517:...'
 *   await hrhub.route.navigate('review:517:abc');       // pushes /hr-hub/apps/<slug>/review:517:abc
 *   await hrhub.route.back('list');                     // history back, or navigate to the fallback when entered directly
 *   const off = hrhub.route.onChange(function (path) { ... });   // fires on navigate/back/forward
 *
 * Logged-in user (never includes tokens; anonymous visitors get authenticated:false):
 *   const me = await hrhub.user.get();
 *   // { authenticated, id, username, name, email, roles: [...], groups: [...] }
 *   // roles = realm + client roles. groups = the identity provider's "groups" claim (empty when not released).
 *   if (me.roles.includes('hr')) { ... }   // UI convenience only: the data API enforces access server-side
 *
 * Employee directory (read-only, no contact details):
 *   const employees = await hrhub.employees.list();   // [{ id, employeeCode, name, department, position }]
 *
 * Read ANOTHER app's data (read-only; allowed only if the user may open that app):
 *   const entries = await hrhub.apps.readData('other-app-slug');   // [{ key, value, updatedAt }]
 *
 * Values are JSON (max ~1 MB). Keys: letters, digits, . _ : - (max 128 chars).
 * Optimistic concurrency: const e = await hrhub.data.getEntry(key); await hrhub.data.set(key, v, { ifUpdatedAt: e.updatedAt });
 */
(function () {
  'use strict';

  // Opened directly (not inside HR Hub): redirect into the viewer so the user is authenticated.
  if (window.parent === window) {
    var match = location.pathname.match(/\/apps\/([^/]+)\//);
    if (match) location.replace('/hr-hub/apps/' + match[1]);
    return;
  }

  var pending = {};
  var seq = 0;
  var routeListeners = [];

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) return;
    var data = event.data;

    // The viewer pushes the current sub-route whenever it changes.
    if (data && data.type === 'hrhub:route') {
      routeListeners.slice().forEach(function (listener) {
        try {
          listener(data.path || '');
        } catch (e) {
          if (window.console) console.error(e);
        }
      });
      return;
    }

    if (!data || data.type !== 'hrhub:response') return;

    var entry = pending[data.id];
    if (!entry) return;
    delete pending[data.id];

    if (data.ok) {
      entry.resolve(data.result);
    } else {
      var error = new Error((data.error && data.error.message) || 'Request failed');
      error.status = data.error && data.error.status;
      entry.reject(error);
    }
  });

  function call(op, args) {
    return new Promise(function (resolve, reject) {
      var id = ++seq;
      pending[id] = { resolve: resolve, reject: reject };
      window.parent.postMessage({ type: 'hrhub:request', id: id, op: op, args: args || {} }, '*');
    });
  }

  window.hrhub = {
    route: {
      get: function () {
        return call('route.get');
      },
      navigate: function (path, options) {
        return call('route.navigate', { path: path || '', replace: !!(options && options.replace) });
      },
      back: function (fallback) {
        return call('route.back', { fallback: fallback || '' });
      },
      onChange: function (listener) {
        routeListeners.push(listener);
        return function () {
          routeListeners = routeListeners.filter(function (item) {
            return item !== listener;
          });
        };
      },
    },
    user: {
      get: function () {
        return call('me');
      },
    },
    apps: {
      readData: function (slug) {
        return call('readApp', { app: slug });
      },
    },
    employees: {
      list: function () {
        return call('employees');
      },
    },
    data: {
      all: function () {
        return call('all');
      },
      list: function () {
        return call('list');
      },
      getEntry: function (key) {
        return call('get', { key: key });
      },
      get: function (key) {
        return call('get', { key: key }).then(function (entry) {
          return entry ? entry.value : null;
        });
      },
      set: function (key, value, options) {
        return call('set', { key: key, value: value, ifUpdatedAt: options && options.ifUpdatedAt });
      },
      remove: function (key) {
        return call('remove', { key: key });
      },
    },
  };
})();
