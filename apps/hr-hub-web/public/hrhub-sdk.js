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
 *   await hrhub.user.login();    // visitors of public apps: sign in, then come back to this exact page
 *   await hrhub.user.logout();   // sign out (ends the session), then come back to this exact page
 * HR Hub's own top bar already shows the signed-in user with a logout menu (or a login button), so apps do not
 * need their own unless they show extra details.
 *
 * Employee directory (read-only, no contact details):
 *   const employees = await hrhub.employees.list();   // [{ id, employeeCode, name, department, position }]
 *
 * Settings (declared in the app's hrhub.json "settings", filled in by the administrator per app; never secrets):
 *   const settings = await hrhub.settings.get();   // { sourceApp: 'leave-requests', maxPlayers: 500 }
 *
 * Read ANOTHER app's data (read-only; allowed only if the user may open that app):
 *   const entries = await hrhub.apps.readData({ setting: 'sourceApp' });   // the app chosen in an "app" setting
 *   const entries = await hrhub.apps.readData('other-app-slug');           // or a fixed slug (avoid hard-coding)
 *
 * Values are JSON (max ~1 MB). Keys: letters, digits, . _ : - (max 128 chars).
 * Optimistic concurrency: const e = await hrhub.data.getEntry(key); await hrhub.data.set(key, v, { ifUpdatedAt: e.updatedAt });
 *
 * Realtime channels (live quizzes, polls, check-ins...). A channel belongs to the app that opens it (the host); the
 * apps listed for it in that app's hrhub.json may join it (participants). Participants only talk to the host.
 *   // host (owner app; its hrhub.json declares { "realtime": { "channels": [{ "prefix": "event:", "participants": [...] }] } })
 *   const ch = await hrhub.realtime.open('event:8F3K');
 *   ch.onPresence(function (p) { ... });            // { hostOnline, count, online, participants: [{ id, name, online, ... }] }
 *   ch.on('answer', function (payload, meta) { ... });   // meta = { from: { id, name, username, anonymous, app }, at }
 *   const { at } = await ch.setState({ phase: 'question', idx: 0 });   // retained: late joiners get it on join
 *   await ch.broadcast('reveal', { correct: 2 });   await ch.sendTo([memberId], 'score', { score: 900 });
 *   await ch.sendEach('result', { [memberIdA]: { score: 900 }, [memberIdB]: { score: 450 } });   // one call, own payload each
 *   await ch.kick(memberId);   await ch.close();
 *   // participant (another app, or the same one)
 *   const ch = await hrhub.realtime.join({ appSetting: 'hostApp', channel: 'event:8F3K', nickname: 'An' });   // or app: '<slug>'
 *   ch.onState(function (state) { ... });           // also called once right away with the current state
 *   await ch.send('answer', { idx: 0, choice: 2 }, { persist: 'q0' });   // persist: also stored in the owner app's data
 *   ch.onClose(function (reason) { ... });          // 'closed' | 'host_left' | 'kicked' | ...
 *   hrhub.realtime.now();                           // server clock estimate (ms), for countdowns
 *   hrhub.realtime.onPing(function (ms) { ... });   // this device's ping, measured by the server every ~5 s
 *   ch.onLatency(function (pings, hostMs) { ... }); // host: { participantId: ms } every ~5 s
 *   await ch.putAsset('img:q1', dataUrl);            // host: share something big (<= 256 KB, 4 MB per channel) once
 *   const dataUrl = await ch.getAsset('img:q1');     // members: fetch it when needed (cached)
 * Errors carry error.code: not_found, forbidden, login_required, full, in_use, nickname_taken, too_large, rate_limited.
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
  var channels = {}; // channel id -> Channel
  var statusListeners = [];
  var pingListeners = [];
  var lastPing = null; // round trip to the server in ms, measured by the server
  var settingsPromise = null; // hrhub.settings.get(), fetched once
  // Server clock minus local clock. Every server event is stamped (at) before it travels, so the largest sample
  // is the closest to the truth.
  var clockOffset = null;

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

    if (data && data.type === 'hrhub:realtime') {
      onRealtime(data.event, data.data || {});
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
      error.code = data.error && data.error.code;
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

  function emit(listeners, args) {
    listeners.slice().forEach(function (listener) {
      try {
        listener.apply(null, args);
      } catch (e) {
        if (window.console) console.error(e);
      }
    });
  }

  function sampleClock(at) {
    if (typeof at !== 'number') return;
    var offset = at - Date.now();
    if (clockOffset === null || offset > clockOffset) clockOffset = offset;
  }

  function onRealtime(event, data) {
    sampleClock(data.at);
    if (event === 'status') {
      emit(statusListeners, [data]);
      return;
    }
    if (event === 'ping') {
      lastPing = data.ms;
      emit(pingListeners, [data.ms]);
      return;
    }
    var channel = channels[data.channel];
    if (!channel) return;
    if (event === 'state') channel._setState(data.state, data.at);
    else if (event === 'presence') channel._setPresence(data.presence);
    else if (event === 'message') channel._message(data.type, data.payload, data.meta);
    else if (event === 'latency') emit(channel._listeners.latency, [data.pings || {}, data.host]);
    else if (event === 'resync') {
      channel._setPresence(data.presence);
      channel._setState(data.state, data.stateAt);
    } else if (event === 'closed') {
      delete channels[data.channel];
      emit(channel._listeners.close, [data.reason]);
    }
  }

  function off(list, listener) {
    var index = list.indexOf(listener);
    if (index >= 0) list.splice(index, 1);
  }

  function Channel(role, result) {
    var self = this;
    this.id = result.channel;
    this.role = role;
    this.me = result.you;
    this.state = result.state;
    this.presence = result.presence;
    this._listeners = { state: [], presence: [], close: [], latency: [], message: {} };
    this._assets = {}; // key -> Promise<data> (fetched once per channel)

    this._setState = function (state) {
      self.state = state;
      emit(self._listeners.state, [state]);
    };
    this._setPresence = function (presence) {
      self.presence = presence;
      emit(self._listeners.presence, [presence]);
    };
    this._message = function (type, payload, meta) {
      emit(self._listeners.message[type] || [], [payload, meta]);
      emit(self._listeners.message['*'] || [], [payload, meta, type]);
    };
  }

  function listen(list, listener) {
    list.push(listener);
    return function () {
      off(list, listener);
    };
  }

  Channel.prototype = {
    /** Messages of one type ('*' = every type; the listener then also gets the type). Returns an unsubscribe function. */
    on: function (type, listener) {
      var list = this._listeners.message[type] || (this._listeners.message[type] = []);
      return listen(list, listener);
    },
    /** Called right away with the current state, then on every change. */
    onState: function (listener) {
      var unsubscribe = listen(this._listeners.state, listener);
      listener(this.state);
      return unsubscribe;
    },
    /** Called right away with the current presence, then on every change. */
    onPresence: function (listener) {
      var unsubscribe = listen(this._listeners.presence, listener);
      if (this.presence) listener(this.presence);
      return unsubscribe;
    },
    onClose: function (listener) {
      return listen(this._listeners.close, listener);
    },
    /** Host: participants' pings every few seconds, (pings: { participantId: ms }, hostMs). */
    onLatency: function (listener) {
      return listen(this._listeners.latency, listener);
    },
    // host
    setState: function (state) {
      return call('rt.state', { channel: this.id, state: state === undefined ? null : state });
    },
    broadcast: function (type, payload) {
      return call('rt.broadcast', { channel: this.id, type: type, payload: payload === undefined ? null : payload });
    },
    sendTo: function (to, type, payload) {
      return call('rt.sendTo', { channel: this.id, to: to, type: type, payload: payload === undefined ? null : payload });
    },
    /** A different payload per participant in one call: { participantId: payload }. */
    sendEach: function (type, messages) {
      return call('rt.sendEach', { channel: this.id, type: type, messages: messages || {} });
    },
    /** Host: share content bigger than a message (an image data URL...) once; members read it with getAsset. */
    putAsset: function (key, data) {
      var assets = this._assets;
      return call('rt.assetPut', { channel: this.id, key: key, data: data }).then(function (result) {
        assets[key] = Promise.resolve(data);
        return result;
      });
    },
    /** Any member: the asset's data (cached: each key is fetched once). */
    getAsset: function (key) {
      var assets = this._assets;
      if (!assets[key]) {
        assets[key] = call('rt.assetGet', { channel: this.id, key: key }).then(
          function (result) {
            return result.data;
          },
          function (error) {
            delete assets[key];
            throw error;
          },
        );
      }
      return assets[key];
    },
    kick: function (participantId) {
      return call('rt.kick', { channel: this.id, participant: participantId });
    },
    close: function () {
      var id = this.id;
      return call('rt.close', { channel: id }).then(function (result) {
        delete channels[id];
        return result;
      });
    },
    // participant
    send: function (type, payload, options) {
      return call('rt.send', {
        channel: this.id,
        type: type,
        payload: payload === undefined ? null : payload,
        persist: (options && options.persist) || undefined,
      });
    },
    leave: function () {
      var id = this.id;
      return call('rt.leave', { channel: id }).then(function (result) {
        delete channels[id];
        return result;
      });
    },
  };

  function attach(role, result) {
    sampleClock(result.at);
    var existing = channels[result.channel];
    if (existing) {
      existing._setPresence(result.presence);
      existing._setState(result.state);
      return existing;
    }
    return (channels[result.channel] = new Channel(role, result));
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
      login: function () {
        return call('user.login');
      },
      logout: function () {
        return call('user.logout');
      },
    },
    apps: {
      /** slug, or { setting: '<"app" setting key>' } to read the app the administrator chose. */
      readData: function (target) {
        return call('readApp', typeof target === 'object' && target ? { setting: target.setting } : { app: target });
      },
    },
    settings: {
      get: function () {
        if (!settingsPromise) {
          settingsPromise = call('settings').catch(function (error) {
            settingsPromise = null;
            throw error;
          });
        }
        return settingsPromise;
      },
    },
    realtime: {
      /** Host a channel of this app (name: letters, digits, . _ : - ; must match a prefix in hrhub.json). */
      open: function (name) {
        return call('rt.open', { channel: name }).then(function (result) {
          return attach('host', result);
        });
      },
      /**
       * Join an open channel: { app: owner slug | appSetting: '<"app" setting key>' (default: this app), channel,
       * nickname (required when not signed in) }.
       */
      join: function (options) {
        options = options || {};
        var owner = options.appSetting
          ? window.hrhub.settings.get().then(function (settings) {
              var slug = settings[options.appSetting];
              if (!slug) throw new Error('Setting "' + options.appSetting + '" is not set');
              return slug;
            })
          : Promise.resolve(options.app);
        return owner
          .then(function (app) {
            return call('rt.join', { app: app, channel: options.channel, nickname: options.nickname });
          })
          .then(function (result) {
            return attach('participant', result);
          });
      },
      /** Server time in ms (Date.now() until the first server event arrives). */
      now: function () {
        return Date.now() + (clockOffset || 0);
      },
      /** This device's round trip to the server in ms (measured by the server), null until known. */
      ping: function () {
        return lastPing;
      },
      /** Called with the ping (ms) whenever the server measured it again (every ~5 s). */
      onPing: function (listener) {
        return listen(pingListeners, listener);
      },
      /** Connection changes: { connected, reason? }. Channels are rejoined automatically after a reconnect. */
      onStatus: function (listener) {
        return listen(statusListeners, listener);
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
