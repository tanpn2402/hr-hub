import { useCallback, useEffect, useState } from 'react';
import { fetchReport, fetchReportList, reportExportUrl } from './api';
import { ReportTable } from './components/ReportTable';
import { SheetTabs } from './components/SheetTabs';
import { UploadPanel } from './components/UploadPanel';
import type { MonthlyReport, MonthlyReportSummary } from './types';

export default function App() {
  const [reports, setReports] = useState<MonthlyReportSummary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<MonthlyReport | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const loadList = useCallback(async (selectAfterLoad?: string | null) => {
    setLoadingList(true);
    setError(null);
    try {
      const list = await fetchReportList();
      setReports(list);
      const nextMonth = selectAfterLoad ?? list[0]?.month ?? null;
      setSelectedMonth(nextMonth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách báo cáo.');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedMonth) {
      setActiveReport(null);
      return;
    }
    let cancelled = false;
    setLoadingReport(true);
    setError(null);
    fetchReport(selectedMonth)
      .then((report) => {
        if (!cancelled) setActiveReport(report);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được báo cáo.');
      })
      .finally(() => {
        if (!cancelled) setLoadingReport(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMonth]);

  function handleImported(month: string | null) {
    setShowUpload(false);
    void loadList(month);
  }

  return (
    <div className="app">
      <div className="title-bar">
        <h1>{activeReport ? `${activeReport.label} - TTL VIETNAM` : 'Báo cáo đi trễ - TTL VIETNAM'}</h1>
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={() => setShowUpload(true)}>
            + Nhập báo cáo
          </button>
          {selectedMonth && (
            <a className="btn" href={reportExportUrl(selectedMonth)}>
              Xuất Excel
            </a>
          )}
        </div>
      </div>

      <div className="sheet-area">
        {loadingList && <p className="status-message">Đang tải danh sách báo cáo...</p>}
        {!loadingList && error && <p className="status-message error-text">{error}</p>}
        {!loadingList && !error && reports.length === 0 && (
          <p className="status-message">Chưa có báo cáo nào. Nhấn "+ Nhập báo cáo" để bắt đầu.</p>
        )}
        {!loadingList && !error && reports.length > 0 && loadingReport && <p className="status-message">Đang tải sheet...</p>}
        {!loadingList && !error && activeReport && !loadingReport && <ReportTable report={activeReport} />}
      </div>

      <SheetTabs reports={reports} selectedMonth={selectedMonth} onSelect={setSelectedMonth} onAddClick={() => setShowUpload(true)} />

      {showUpload && <UploadPanel onClose={() => setShowUpload(false)} onImported={handleImported} />}
    </div>
  );
}
