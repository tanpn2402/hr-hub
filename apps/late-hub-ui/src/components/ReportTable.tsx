import { Fragment } from 'react';
import type { MonthlyReport } from '../types';

const HEADERS = ['Mã NV', 'Tên nhân viên', 'Ngày', 'Thứ', 'Giờ vào', 'Giờ ra', 'Ghi chú', 'Phạt đi trễ (VNĐ)'];

const currencyFormatter = new Intl.NumberFormat('vi-VN');
const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(`${iso}T00:00:00`));
}

interface Props {
  report: MonthlyReport;
}

/** Renders the report as a spreadsheet: day-by-day rows, a subtotal row per employee, and a grand total row. */
export function ReportTable({ report }: Props) {
  const groups: { employeeCode: string; employeeName: string; rows: MonthlyReport['rows'] }[] = [];
  for (const row of report.rows) {
    const currentGroup = groups[groups.length - 1];
    if (!currentGroup || currentGroup.employeeCode !== row.employeeCode) {
      groups.push({ employeeCode: row.employeeCode, employeeName: row.employeeName, rows: [row] });
    } else {
      currentGroup.rows.push(row);
    }
  }

  return (
    <table className="sheet-table">
      <thead>
        <tr>
          {HEADERS.map((header) => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => {
          const employeeTotal = group.rows.reduce((sum, row) => sum + row.fineAmount, 0);
          return (
            <Fragment key={group.employeeCode}>
              {group.rows.map((row, index) => (
                <tr
                  key={`${row.employeeCode}-${row.date}`}
                  className={`${index % 2 === 1 ? 'row-banded' : 'row-white'} ${row.fineAmount > 0 ? 'has-fine' : 'no-fine'}`}
                >
                  <td>{row.employeeCode}</td>
                  <td>{row.employeeName}</td>
                  <td>{formatDate(row.date)}</td>
                  <td>{row.dayOfWeek}</td>
                  <td>{row.checkIn ?? ''}</td>
                  <td>{row.checkOut ?? ''}</td>
                  <td className="col-note">{row.note ?? ''}</td>
                  <td className="col-fine">{currencyFormatter.format(row.fineAmount)}</td>
                </tr>
              ))}
              <tr className="subtotal-row">
                <td>{group.employeeCode}</td>
                <td colSpan={6}>Tổng: {group.employeeName}</td>
                <td className="col-fine">{currencyFormatter.format(employeeTotal)}</td>
              </tr>
            </Fragment>
          );
        })}
        <tr className="grand-total-row">
          <td colSpan={7}>TỔNG CỘNG TOÀN CÔNG TY</td>
          <td className="col-fine">{currencyFormatter.format(report.grandTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}
