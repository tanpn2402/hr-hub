/*!
 * HR Hub Web App UI helpers (dialog + searchable select)
 *
 * Include AFTER the SDK in your app's index.html (the theme provides the styles):
 *   <link rel="stylesheet" href="/hr-hub/hrhub-theme.css" />
 *   <script src="/hr-hub/hrhub-sdk.js"></script>
 *   <script src="/hr-hub/hrhub-ui.js"></script>
 *
 * Dialog (native <dialog>: focus trap, Esc, backdrop). All promises resolve, never reject:
 *   await hrhub.ui.alert('Đã lưu.', { title: 'Thành công' });                 // -> true
 *   const ok = await hrhub.ui.confirm('Xóa bản ghi?', { destructive: true }); // -> true | false
 *   const v = await hrhub.ui.dialog({
 *     title: 'Chi tiết', content: stringOrNode,                               // strings are shown as plain text
 *     actions: [{ label: 'Đóng', value: 'close', variant: 'outline' }, { label: 'Lưu', value: 'save' }],
 *     dismissible: true, width: '32rem',
 *   });                                                                       // -> action.value, or null when dismissed
 *
 * Searchable select (replaces <select>; accent- and case-insensitive search, keyboard: arrows/Enter/Esc):
 *   const cb = hrhub.ui.combobox(containerElement, {
 *     options: [{ value: 'NV001', label: 'NV001 - An', hint: 'Phòng IT' }],  // hint + searchText are searchable too
 *     value: '', placeholder: '— Chọn —', emptyText: 'Không tìm thấy', id: 'employee', ariaLabel: '...',
 *     onChange: (value, option) => {},
 *   });
 *   cb.getValue(); cb.setValue('NV001'); cb.setOptions([...]); cb.setDisabled(true); cb.input  // the <input> element
 *
 * Checkbox (custom look, no native <input type="checkbox">; a <button role="checkbox">, Space/Enter toggles):
 *   const c = hrhub.ui.checkbox(containerElement, { label: 'Dùng nhiều màn hình', checked: false, onChange: (checked) => {} });
 *   c.getChecked(); c.setChecked(true); c.setDisabled(true); c.button  // the focusable <button>
 */
(function () {
  'use strict';

  var seq = 0;

  function make(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  // lower-case, strip Vietnamese/Latin diacritics so "nguyen" finds "Nguyễn"
  function normalize(text) {
    return String(text == null ? '' : text)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  }

  // ---------------- dialog ----------------

  function dialog(options) {
    var o = options || {};
    return new Promise(function (resolve) {
      var dlg = make('dialog', 'hh-dialog');
      var titleId = 'hh-dlg-' + ++seq;
      if (o.width) dlg.style.setProperty('--hh-dialog-width', o.width);

      if (o.title) {
        var header = make('div', 'hh-dialog-header');
        var h = make('h2');
        h.id = titleId;
        h.textContent = o.title;
        header.appendChild(h);
        dlg.appendChild(header);
        dlg.setAttribute('aria-labelledby', titleId);
      }

      var body = make('div', 'hh-dialog-body');
      if (o.content instanceof Node) body.appendChild(o.content);
      else if (o.content != null) body.textContent = String(o.content);
      dlg.appendChild(body);

      var result = null;
      var actions = o.actions && o.actions.length ? o.actions : [{ label: 'Đóng', value: true }];
      var footer = make('div', 'hh-dialog-footer');
      var primary = null;
      actions.forEach(function (a, i) {
        var btn = make('button', 'hh-btn ' + (a.variant ? 'hh-btn-' + a.variant : ''));
        btn.type = 'button';
        btn.textContent = a.label;
        btn.addEventListener('click', function () {
          dismiss(a.value === undefined ? true : a.value);
        });
        footer.appendChild(btn);
        if (a.autofocus || (!primary && i === actions.length - 1)) primary = a.autofocus ? btn : primary || btn;
      });
      dlg.appendChild(footer);

      // closing plays the exit transition first (fade + zoom out), then really closes the <dialog>
      var closing = false;
      function dismiss(value) {
        if (closing) return;
        closing = true;
        result = value;
        var finished = false;
        function finish() {
          if (finished) return;
          finished = true;
          dlg.close();
        }
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          finish();
          return;
        }
        dlg.addEventListener('transitionend', function (e) {
          if (e.target === dlg && e.propertyName === 'opacity') finish();
        });
        setTimeout(finish, 250);  // safety net when no transition runs
        dlg.setAttribute('data-state', 'closed');
      }

      // Esc: take over so the exit transition runs
      dlg.addEventListener('cancel', function (e) {
        e.preventDefault();
        if (o.dismissible !== false) dismiss(null);
      });
      if (o.dismissible !== false) {
        // clicks on the backdrop are dispatched on the <dialog> itself (it has no padding of its own).
        // Only close when the press ALSO started on the backdrop: dragging a text selection from inside the dialog
        // and releasing outside fires a click on the <dialog> too, and must not close it.
        var pressedOnBackdrop = false;
        dlg.addEventListener('pointerdown', function (e) { pressedOnBackdrop = e.target === dlg; });
        dlg.addEventListener('click', function (e) {
          if (e.target === dlg && pressedOnBackdrop) dismiss(null);
          pressedOnBackdrop = false;
        });
      }
      dlg.addEventListener('close', function () {
        dlg.remove();
        resolve(result);
      });

      document.body.appendChild(dlg);
      dlg.showModal();
      void dlg.offsetWidth;  // commit the initial (hidden) styles so the open transition runs
      dlg.setAttribute('data-state', 'open');
      if (primary) primary.focus();
    });
  }

  function alertDialog(message, options) {
    var o = options || {};
    return dialog({
      title: o.title,
      content: message,
      actions: [{ label: o.okLabel || 'Đóng', value: true }],
    });
  }

  function confirmDialog(message, options) {
    var o = options || {};
    return dialog({
      title: o.title || 'Xác nhận',
      content: message,
      dismissible: o.dismissible,
      actions: [
        { label: o.cancelLabel || 'Hủy', value: false, variant: 'outline' },
        { label: o.confirmLabel || 'Xác nhận', value: true, variant: o.destructive ? 'destructive' : '' },
      ],
    }).then(function (v) { return v === true; });
  }

  // ---------------- searchable select ----------------

  function combobox(host, opts) {
    var o = opts || {};
    var uid = 'hh-cb-' + ++seq;
    var options = [];
    var filtered = [];
    var value = '';
    var isOpen = false;
    var active = -1;

    var root = make('div', 'hh-combobox');
    var input = make('input', 'hh-input hh-combobox-input');
    input.type = 'text';
    input.id = o.id || uid + '-input';
    input.placeholder = o.placeholder || '';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', uid + '-list');
    if (o.ariaLabel) input.setAttribute('aria-label', o.ariaLabel);
    var list = make('ul', 'hh-combobox-list');
    list.id = uid + '-list';
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    root.appendChild(input);
    root.appendChild(list);
    host.appendChild(root);

    function selectedOption() {
      for (var i = 0; i < options.length; i++) if (options[i].value === value) return options[i];
      return null;
    }

    function showLabel() {
      var sel = selectedOption();
      input.value = sel ? sel.label : '';
    }

    function render() {
      list.innerHTML = '';
      if (!filtered.length) {
        var empty = make('li', 'hh-combobox-empty');
        empty.textContent = o.emptyText || 'Không tìm thấy';
        list.appendChild(empty);
        input.removeAttribute('aria-activedescendant');
        return;
      }
      filtered.forEach(function (opt, i) {
        var li = make('li', 'hh-combobox-option');
        li.id = uid + '-opt-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(opt.value === value));
        if (i === active) li.setAttribute('data-active', '');
        var label = make('span');
        label.textContent = opt.label;
        li.appendChild(label);
        if (opt.hint) {
          var hint = make('small', 'hh-hint');
          hint.textContent = opt.hint;
          li.appendChild(hint);
        }
        // mousedown (not click) + preventDefault keeps focus in the input so blur doesn't close first
        li.addEventListener('mousedown', function (e) {
          e.preventDefault();
          choose(opt);
        });
        li.addEventListener('mousemove', function () { setActive(i, false); });
        list.appendChild(li);
      });
      if (active >= 0) input.setAttribute('aria-activedescendant', uid + '-opt-' + active);
    }

    function setActive(i, scroll) {
      if (i === active) return;
      var prev = list.querySelector('[data-active]');
      if (prev) prev.removeAttribute('data-active');
      active = i;
      var node = document.getElementById(uid + '-opt-' + i);
      if (node) {
        node.setAttribute('data-active', '');
        input.setAttribute('aria-activedescendant', node.id);
        if (scroll) node.scrollIntoView({ block: 'nearest' });
      }
    }

    function applyFilter(query) {
      var q = normalize(query).trim();
      filtered = !q ? options.slice() : options.filter(function (opt) {
        return normalize(opt.label + ' ' + (opt.hint || '') + ' ' + (opt.searchText || '')).indexOf(q) !== -1;
      });
      active = -1;
      for (var i = 0; i < filtered.length; i++) if (!q && filtered[i].value === value) active = i;
      if (active < 0 && filtered.length) active = 0;
      render();
    }

    function open() {
      if (isOpen || input.disabled) return;
      isOpen = true;
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      applyFilter('');
      var node = list.querySelector('[data-active]');
      if (node) node.scrollIntoView({ block: 'nearest' });
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      showLabel();
    }

    function choose(opt) {
      var changed = opt.value !== value;
      value = opt.value;
      close();
      if (changed && typeof o.onChange === 'function') o.onChange(value, opt);
    }

    input.addEventListener('focus', function () { open(); input.select(); });
    input.addEventListener('click', function () { open(); });
    input.addEventListener('blur', close);
    input.addEventListener('input', function () {
      if (!isOpen) open();
      applyFilter(input.value);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) { open(); return; }
        if (!filtered.length) return;
        var step = e.key === 'ArrowDown' ? 1 : -1;
        setActive((active + step + filtered.length) % filtered.length, true);
      } else if (e.key === 'Home' || e.key === 'End') {
        if (isOpen && filtered.length) {
          e.preventDefault();
          setActive(e.key === 'Home' ? 0 : filtered.length - 1, true);
        }
      } else if (e.key === 'Enter') {
        if (isOpen) {
          e.preventDefault();  // don't submit the surrounding form
          if (filtered[active]) choose(filtered[active]);
        }
      } else if (e.key === 'Escape') {
        if (isOpen) {
          e.stopPropagation();  // close the list, not an enclosing dialog
          e.preventDefault();
          close();
        }
      } else if (e.key === 'Tab') {
        close();
      }
    });

    var api = {
      input: input,
      element: root,
      getValue: function () { return value; },
      setValue: function (v) {
        value = v == null ? '' : String(v);
        if (!isOpen) showLabel();
      },
      setOptions: function (next) {
        options = (next || []).map(function (opt) {
          return { value: String(opt.value), label: String(opt.label), hint: opt.hint, searchText: opt.searchText };
        });
        if (value && !selectedOption()) value = '';
        if (isOpen) applyFilter(input.value); else showLabel();
      },
      setDisabled: function (disabled) {
        input.disabled = !!disabled;
        if (disabled) close();
      },
    };
    api.setOptions(o.options);
    if (o.value != null) api.setValue(o.value);
    return api;
  }

  // ---------------- checkbox ----------------

  var CHECK_SVG = 'http://www.w3.org/2000/svg';

  function checkbox(host, opts) {
    var o = opts || {};
    var checked = !!o.checked;

    var btn = make('button', 'hh-checkbox');
    btn.type = 'button';
    btn.setAttribute('role', 'checkbox');
    if (o.id) btn.id = o.id;
    if (o.ariaLabel) btn.setAttribute('aria-label', o.ariaLabel);

    var box = make('span', 'hh-checkbox-box');
    var svg = document.createElementNS(CHECK_SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(CHECK_SVG, 'path');
    path.setAttribute('d', 'M3.5 8.5l3 3 6-7');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    box.appendChild(svg);
    btn.appendChild(box);
    if (o.label != null) {
      var text = make('span', 'hh-checkbox-label');
      text.textContent = o.label;
      btn.appendChild(text);
    }

    function sync() {
      btn.setAttribute('aria-checked', String(checked));
    }

    btn.addEventListener('click', function () {
      checked = !checked;
      sync();
      if (typeof o.onChange === 'function') o.onChange(checked);
    });
    sync();
    host.appendChild(btn);

    return {
      button: btn,
      element: btn,
      getChecked: function () { return checked; },
      setChecked: function (v) { checked = !!v; sync(); },
      setDisabled: function (d) { btn.disabled = !!d; },
    };
  }

  var ui = { checkbox: checkbox, dialog: dialog, alert: alertDialog, confirm: confirmDialog, combobox: combobox };
  window.hrhubUI = ui;
  if (window.hrhub) window.hrhub.ui = ui;
})();
