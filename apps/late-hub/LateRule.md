# LateRule — Quy định tính phạt đi trễ

Tài liệu này mô tả toàn bộ quy định nghiệp vụ đang được triển khai trong
[late-fine-calculator.service.ts](src/modules/workforce/late-fine-calculator.service.ts),
[workforce-rules.model.ts](src/modules/workforce/models/workforce-rules.model.ts) và các parser liên quan.
Mọi mốc giờ / mức phạt đều cấu hình được qua `.env`, không hard-code trong code.

## 1. Khung giờ làm việc

- Công ty làm việc các ngày trong `WORKFORCE_WORKDAYS` (mặc định: **Thứ 2 → Thứ 6**).
- Buổi sáng: bắt đầu lúc `WORKFORCE_MORNING_START`, kết thúc lúc `WORKFORCE_MORNING_END`.
- Buổi chiều: bắt đầu lúc `WORKFORCE_AFTERNOON_START`, kết thúc theo giờ làm thực tế (thường 17:30).
- Chỉ những ngày nằm trong `WORKFORCE_WORKDAYS`, **hoặc** được khai báo thêm trong `WORKFORCE_MAKEUP_WORKDAYS`
  (ngày làm bù), mới bị áp dụng các quy định phạt bên dưới. Các ngày khác (kể cả có chấm công) được bỏ qua hoàn toàn.

## 2. Bốn quy định phạt

Với mỗi ngày công của một nhân viên, hệ thống xác định trạng thái nghỉ phép buổi sáng/chiều
(`coverage.morning` / `coverage.afternoon`, xem mục 4), rồi áp dụng:

| #                                        | Điều kiện                                                                                                                                                             | Hành vi                            | Mức phạt (mặc định)                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------- |
| **Nghỉ cả ngày**                         | Nghỉ phép cả sáng lẫn chiều                                                                                                                                           | Miễn phạt hoàn toàn, ghi chú `P`   | 0đ                                              |
| **1. Trễ giờ vào buổi sáng**             | Buổi sáng **không** nghỉ phép, và (không có giờ vào **hoặc** giờ vào sau `WORKFORCE_MORNING_START`)                                                                   | Phạt                               | `WORKFORCE_FINE_LATE_MORNING` = 30.000đ         |
| **2. Trễ giờ vào buổi chiều**            | Buổi sáng **có** nghỉ phép (đi làm buổi chiều), và (không có giờ vào **hoặc** giờ vào sau `WORKFORCE_AFTERNOON_START`)                                                | Phạt                               | `WORKFORCE_FINE_LATE_AFTERNOON` = 30.000đ       |
| **3. Checkout sớm khi nghỉ chiều**       | Buổi sáng đi làm, buổi chiều nghỉ phép, và (không có giờ ra **hoặc** giờ ra **trước** `WORKFORCE_MORNING_CHECKOUT_DEADLINE`)                                          | Phạt — _bỏ qua nếu là ngày làm bù_ | `WORKFORCE_FINE_NO_CHECKOUT_HALF_DAY` = 10.000đ |
| **4. Không checkout đúng giờ (cả ngày)** | Không nghỉ chiều (cả ngày làm việc, hoặc đi làm buổi chiều sau khi nghỉ sáng), và (không có giờ ra **hoặc** giờ ra **trước** `WORKFORCE_AFTERNOON_CHECKOUT_DEADLINE`) | Phạt — _bỏ qua nếu là ngày làm bù_ | `WORKFORCE_FINE_NO_CHECKOUT_FULL_DAY` = 10.000đ |

Ghi chú quan trọng:

- Quy định 1 và 2 luôn được kiểm tra (kể cả ngày làm bù); quy định 3 và 4 (liên quan đến giờ ra) **bị bỏ qua** nếu ngày đó
  là ngày làm bù (xem mục 5).
- Thiếu hẳn giờ vào (không chỉ trễ) cũng bị phạt như trễ giờ vào — vì đây là dấu hiệu nhân viên không chấm công đúng quy định.
- Một ngày có thể bị cộng dồn **nhiều loại phạt cùng lúc** (ví dụ vừa trễ giờ vào vừa không checkout đúng giờ → 30.000 + 10.000 = 40.000đ).
- Cột "Ghi chú" (`note`) trong kết quả sẽ liệt kê tất cả lý do bị phạt, ví dụ:
  `"P/2 (Nghỉ sáng); Trễ giờ vào buổi chiều"`.

## 3. Ranh giới thời gian — không có phút ân hạn

Mọi so sánh giờ đều là so sánh **chặt** (strict `>` hoặc `<`), không có phút đệm:

- Check-in đúng **bằng** mốc quy định (`WORKFORCE_MORNING_START` / `WORKFORCE_AFTERNOON_START`) → **không** bị phạt.
- Check-in **sau** mốc dù chỉ 1 phút → bị phạt ngay.
- Check-out đúng **bằng** hoặc **sau** mốc deadline (`WORKFORCE_MORNING_CHECKOUT_DEADLINE` / `WORKFORCE_AFTERNOON_CHECKOUT_DEADLINE`) → **không** bị phạt.
- Check-out **trước** mốc dù chỉ 1 phút → bị phạt ngay.

## 4. Xác định nghỉ phép nửa ngày / cả ngày

Dựa trên file `leavedetailsreportbydate_*.xlsx` (cột `Placement Number`, `Leave From`, `Leave To`):

- Buổi sáng được coi là **nghỉ phép** nếu giờ bắt đầu đơn nghỉ (`Leave From`) ≤ `WORKFORCE_LEAVE_DAY_START` (mặc định 08:00).
- Buổi chiều được coi là **nghỉ phép** nếu giờ kết thúc đơn nghỉ (`Leave To`) ≥ `WORKFORCE_LEAVE_DAY_END` (mặc định 17:30).
- Đơn nghỉ nhiều ngày liên tiếp: ngày đầu/cuối xét theo giờ bắt đầu/kết thúc thực tế; các ngày ở giữa được coi là nghỉ trọn ngày.
- Nếu nhân viên có nhiều đơn nghỉ trong cùng 1 ngày (ví dụ 1 đơn sáng + 1 đơn chiều), trạng thái nghỉ được **cộng dồn** (OR).

## 5. Ngày làm bù (`WORKFORCE_MAKEUP_WORKDAYS`)

- Định dạng: danh sách ngày `DD-MM-YYYY`, cách nhau bởi dấu phẩy. Ví dụ: `WORKFORCE_MAKEUP_WORKDAYS=22-08-2026,05-09-2026`.
- Những ngày này **bắt buộc** phải chấm công dù rơi vào cuối tuần (Thứ 7/CN), và bị tính quy định 1 (trễ giờ vào) như ngày thường.
- **Khác biệt duy nhất**: quy định 3 và 4 (phạt do checkout sớm/thiếu checkout) **không áp dụng** vào ngày làm bù —
  chỉ phạt trễ giờ vào, không phạt chuyện về sớm.

## 6. Loại trừ nhân viên (`WORKFORCE_EXCLUDED_EMPLOYEES`)

- Danh sách mã nhân viên (Mã NV), cách nhau bởi dấu phẩy — ví dụ nhân viên đã nghỉ việc.
- Nhân viên trong danh sách này bị loại bỏ **hoàn toàn** khỏi báo cáo (không xuất hiện ở cả danh sách chi tiết
  lẫn phần tổng hợp theo nhân viên), bất kể có vi phạm hay không.

## 7. Override quy định theo từng nhân viên (`WORKFORCE_OVERRIDE_RULE_EMPLOYEES`)

Cho phép áp dụng mốc giờ/mức phạt **riêng** cho một số nhân viên cụ thể, khác với quy định chung toàn công ty.

- Khai báo danh sách mã NV cần override trong `WORKFORCE_OVERRIDE_RULE_EMPLOYEES` (cách nhau bởi dấu phẩy).
- Với mỗi mã NV, khai báo thêm biến môi trường theo dạng `<Mã NV>_<TÊN_BIẾN>` cho bất kỳ biến nào muốn ghi đè —
  biến nào không khai báo sẽ dùng giá trị mặc định chung.
- Các biến có thể override: tất cả biến giờ (`WORKFORCE_MORNING_START`, `WORKFORCE_MORNING_END`,
  `WORKFORCE_MORNING_CHECKOUT_DEADLINE`, `WORKFORCE_AFTERNOON_START`, `WORKFORCE_AFTERNOON_CHECKOUT_DEADLINE`,
  `WORKFORCE_LEAVE_DAY_START`, `WORKFORCE_LEAVE_DAY_END`) và tất cả biến mức phạt (`WORKFORCE_FINE_LATE_MORNING`,
  `WORKFORCE_FINE_LATE_AFTERNOON`, `WORKFORCE_FINE_NO_CHECKOUT_HALF_DAY`, `WORKFORCE_FINE_NO_CHECKOUT_FULL_DAY`).
- Không override được: `WORKFORCE_WORKDAYS`, `WORKFORCE_MAKEUP_WORKDAYS`, `WORKFORCE_EXCLUDED_EMPLOYEES`
  (các quy định phạm vi toàn công ty, không mang tính cá nhân).

Ví dụ trong `.env` hiện tại:

```
WORKFORCE_OVERRIDE_RULE_EMPLOYEES=533
533_WORKFORCE_MORNING_START=08:00
533_WORKFORCE_AFTERNOON_CHECKOUT_DEADLINE=16:15
```

→ Riêng nhân viên mã `533`: giờ vào buổi sáng phải trước **08:00** (thay vì 08:30 chung), và giờ ra buổi chiều
phải sau **16:15** (thay vì 17:15 chung) mới không bị phạt.

## 8. Xử lý dữ liệu chấm công bất thường

File chấm công gốc (`BCC_<Mon>.<Year>.xlsx`) luôn ghi nhận lượt quẹt thẻ **duy nhất** trong ngày vào cột
"Giờ vào", kể cả khi đó rõ ràng là một lượt ra về (ví dụ quên chấm công buổi sáng, chỉ quẹt thẻ lúc tan làm buổi tối).

Nếu "Giờ vào" là giá trị **duy nhất** trong ngày (không có "Giờ ra") và **sau** `WORKFORCE_MORNING_END`,
hệ thống tự động diễn giải lại: giá trị đó được coi là **giờ ra**, còn giờ vào coi như **thiếu hẳn** (bị phạt
theo quy định 1/2 ở mục 2, không bị phạt thêm lỗi checkout vì giờ ra hợp lệ).

## 9. Toàn bộ biến môi trường

| Biến                                    | Mặc định             | Ý nghĩa                                                                |
| --------------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| `WORKFORCE_WORKDAYS`                    | `Hai,Ba,Tư,Năm,Sáu`  | Các ngày trong tuần áp dụng phạt                                       |
| `WORKFORCE_MAKEUP_WORKDAYS`             | _(rỗng)_             | Ngày làm bù, định dạng `DD-MM-YYYY`, nhiều ngày cách nhau bởi dấu phẩy |
| `WORKFORCE_EXCLUDED_EMPLOYEES`          | _(rỗng)_             | Mã NV bị loại khỏi báo cáo, cách nhau bởi dấu phẩy                     |
| `WORKFORCE_OVERRIDE_RULE_EMPLOYEES`     | _(rỗng)_             | Mã NV áp dụng override riêng, cách nhau bởi dấu phẩy                   |
| `WORKFORCE_MORNING_START`               | `08:30`              | Mốc trễ giờ vào buổi sáng (quy định 1)                                 |
| `WORKFORCE_MORNING_END`                 | `11:30`              | Giờ kết thúc buổi sáng (dùng để nhận diện giờ vào bị ghi nhầm — mục 8) |
| `WORKFORCE_MORNING_CHECKOUT_DEADLINE`   | `11:29`              | Mốc phạt checkout sớm khi nghỉ chiều (quy định 3)                      |
| `WORKFORCE_AFTERNOON_START`             | `13:00`              | Mốc trễ giờ vào buổi chiều khi nghỉ sáng (quy định 2)                  |
| `WORKFORCE_AFTERNOON_CHECKOUT_DEADLINE` | `17:15`              | Mốc phạt không checkout đúng giờ cả ngày (quy định 4)                  |
| `WORKFORCE_LEAVE_DAY_START`             | `08:00`              | Mốc xác định đơn nghỉ có phủ buổi sáng hay không                       |
| `WORKFORCE_LEAVE_DAY_END`               | `17:30`              | Mốc xác định đơn nghỉ có phủ buổi chiều hay không                      |
| `WORKFORCE_FINE_LATE_MORNING`           | `30000`              | Mức phạt trễ/thiếu giờ vào buổi sáng                                   |
| `WORKFORCE_FINE_LATE_AFTERNOON`         | `30000`              | Mức phạt trễ/thiếu giờ vào buổi chiều                                  |
| `WORKFORCE_FINE_NO_CHECKOUT_HALF_DAY`   | `10000`              | Mức phạt checkout sớm/thiếu khi nghỉ chiều                             |
| `WORKFORCE_FINE_NO_CHECKOUT_FULL_DAY`   | `10000`              | Mức phạt không checkout đúng giờ cả ngày                               |
| `<Mã NV>_<biến ở trên>`                 | _(kế thừa mặc định)_ | Override riêng cho từng nhân viên — xem mục 7                          |

## 10. Đầu ra

Kết quả tính toán (`LateFineReport`) gồm:

- `rows`: chi tiết theo từng ngày công — mã NV, tên, ngày, thứ, giờ vào, giờ ra, ghi chú, số tiền phạt.
- `employeeSummaries`: tổng tiền phạt theo từng nhân viên.
- `grandTotal`: tổng tiền phạt toàn công ty.

Có thể xuất trực tiếp ra file Excel (1 sheet: chi tiết theo ngày + dòng "Tổng: &lt;tên&gt;" mỗi nhân viên +
dòng "TỔNG CỘNG TOÀN CÔNG TY") qua `GET /workforce/export/:batchId`.
