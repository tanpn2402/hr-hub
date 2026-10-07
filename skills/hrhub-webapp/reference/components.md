# HR Hub theme: component snippets

All classes come from `/hr-hub/hrhub-theme.css`. Copy these patterns.

## Page header + actions
```html
<header class="hh-page-header">
  <div><h1>Tiêu đề</h1><p class="hh-muted">Mô tả ngắn</p></div>
  <div class="hh-row">
    <button class="hh-btn hh-btn-outline" type="button">Xuất file</button>
    <button class="hh-btn" type="button">Tạo mới</button>
  </div>
</header>
```

## Card with metric
```html
<div class="hh-grid">
  <div class="hh-card">
    <div class="hh-metric-icon">👥</div>
    <div class="hh-metric-value" id="total">0</div>
    <div class="hh-muted">Tổng số nhân viên</div>
  </div>
</div>
```

## Form
```html
<form class="hh-card">
  <div class="hh-grid-2">
    <div class="hh-field">
      <label class="hh-label" for="employee">Nhân viên</label>
      <select class="hh-select" id="employee" required><option value="">— Chọn —</option></select>
    </div>
    <div class="hh-field">
      <label class="hh-label" for="period">Kỳ</label>
      <input class="hh-input" id="period" type="month" required />
    </div>
  </div>
  <div class="hh-field">
    <label class="hh-label" for="note">Ghi chú</label>
    <textarea class="hh-textarea" id="note" rows="3"></textarea>
    <span class="hh-hint">Tối đa 2000 ký tự</span>
  </div>
  <button class="hh-btn" type="submit" disabled>Gửi</button>
</form>
```
Invalid field: set `aria-invalid="true"` on the control.

## Rating scale
```html
<div class="hh-scale">
  <label class="hh-scale-item"><input type="radio" name="quality" value="1" /><span>1</span></label>
  <!-- ... 2..5 -->
</div>
```

## Table with clickable rows
```html
<div class="hh-table-wrap">
  <table class="hh-table">
    <thead><tr><th>Nhân viên</th><th>Kỳ</th><th class="hh-num">Điểm</th><th>Trạng thái</th></tr></thead>
    <tbody>
      <tr class="hh-clickable" tabindex="0">
        <td>Nguyễn Văn A</td><td>2026-10</td><td class="hh-num">4.2</td>
        <td><span class="hh-badge hh-badge-secondary"><span class="hh-dot hh-dot-success"></span>Đã gửi</span></td>
      </tr>
    </tbody>
  </table>
</div>
<div class="hh-empty">Chưa có dữ liệu.</div>
```

## Badges, alerts, progress
```html
<span class="hh-badge">Mặc định</span>
<span class="hh-badge hh-badge-success">Tốt</span>
<span class="hh-badge hh-badge-warning">Cần chú ý</span>
<span class="hh-badge hh-badge-destructive">Kém</span>
<div class="hh-alert hh-alert-error">Không thể tải dữ liệu.</div>
<div class="hh-alert hh-alert-success">Đã lưu.</div>
<div class="hh-bar"><div style="width: 60%"></div></div>
```

## Safe rendering of data
```js
const td = document.createElement('td');
td.textContent = row.employeeName;   // never innerHTML with data
```

## SDK call pattern with all states
```js
list.innerHTML = '<div class="hh-empty"><span class="hh-spinner"></span></div>';
hrhub.apps.readData('some-app')
  .then(render)
  .catch((e) => { box.className = 'hh-alert hh-alert-error'; box.textContent = e.message; });
```
