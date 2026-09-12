import { useState } from 'react';
import { importFiles } from '../api';

interface Props {
  onClose: () => void;
  onImported: (month: string | null) => void;
}

/** Modal for uploading the two monthly Excel files (attendance + leave) via POST /workforce/import. */
export function UploadPanel({ onClose, onImported }: Props) {
  const [attendanceFile, setAttendanceFile] = useState<File | null>(null);
  const [leaveFile, setLeaveFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = attendanceFile && leaveFile && !submitting;

  async function handleSubmit() {
    if (!attendanceFile || !leaveFile) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await importFiles(attendanceFile, leaveFile);
      onImported(result.month);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import thất bại, vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>Nhập báo cáo tháng mới</h2>

        <div className="field">
          <label>File chấm công (BCC_&lt;Tháng&gt;.&lt;Năm&gt;.xlsx)</label>
          <input type="file" accept=".xlsx" onChange={(event) => setAttendanceFile(event.target.files?.[0] ?? null)} />
        </div>

        <div className="field">
          <label>File nghỉ phép (leavedetailsreportbydate_&lt;timestamp&gt;.xlsx)</label>
          <input type="file" accept=".xlsx" onChange={(event) => setLeaveFile(event.target.files?.[0] ?? null)} />
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Huỷ
          </button>
          <button type="button" className="btn" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Đang xử lý...' : 'Nhập dữ liệu'}
          </button>
        </div>
      </div>
    </div>
  );
}
