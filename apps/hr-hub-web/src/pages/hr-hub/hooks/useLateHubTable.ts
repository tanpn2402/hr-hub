import { useMemo, useState } from "react";

import {
  stockFeatures,
  tableFeatures,
  TableState,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type WorkforceRow = {
  employeeCode: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  note: string;
  fineAmount: number;
};

export type EmployeeSummary = {
  employeeCode: string;
  employeeName?: string | null;
  totalFine: number;
};

export type WorkforceImportResult = {
  batchId: string;
  status?: "preview" | "confirmed";
  rows: WorkforceRow[];
  employeeSummaries: EmployeeSummary[];
  grandTotal: number;
};

export type ReviewDetailRow = WorkforceRow & {
  rowType: "detail";
  id: string;
};

export type ReviewSummaryRow = {
  rowType: "summary";
  id: string;
  employeeCode: string;
  employeeName: string;
  totalFine: number;
  violationCount: number;
};

export type ReviewTableRow = ReviewDetailRow | ReviewSummaryRow;

export type LateHubSorting = {
  column: string;
  direction: "asc" | "desc";
} | null;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function buildReviewRows(result: WorkforceImportResult): ReviewTableRow[] {
  const grouped = new Map<string, WorkforceRow[]>();

  for (const row of result.rows) {
    const existing = grouped.get(row.employeeCode) ?? [];
    existing.push(row);
    grouped.set(row.employeeCode, existing);
  }

  const summaryMap = new Map(
    result.employeeSummaries.map((summary) => [summary.employeeCode, summary]),
  );

  const output: ReviewTableRow[] = [];

  for (const [employeeCode, rows] of grouped) {
    const sortedRows = [...rows].sort((a, b) => b.date.localeCompare(a.date));

    for (let index = 0; index < sortedRows.length; index++) {
      const row = sortedRows[index];

      output.push({
        ...row,
        rowType: "detail",
        id: `${employeeCode}-${row.date}-${index}`,
      });
    }

    const summary = summaryMap.get(employeeCode);

    output.push({
      rowType: "summary",
      id: `summary-${employeeCode}`,
      employeeCode,
      employeeName:
        summary?.employeeName ?? rows[0]?.employeeName ?? employeeCode,
      totalFine:
        summary?.totalFine ??
        rows.reduce((total, row) => total + row.fineAmount, 0),
      violationCount: rows.length,
    });
  }

  return output;
}

/**
 * Converts the flat table rows into employee groups.
 *
 * Every group contains:
 *
 *   detail
 *   detail
 *   detail
 *   summary
 *
 * Sorting is performed against groups rather than individual rows so the
 * summary row can never become detached from its employee.
 */
function groupRows(rows: ReviewTableRow[]): ReviewTableRow[][] {
  const groups = new Map<string, ReviewTableRow[]>();

  for (const row of rows) {
    const existing = groups.get(row.employeeCode) ?? [];

    existing.push(row);
    groups.set(row.employeeCode, existing);
  }

  return Array.from(groups.values());
}

/**
 * Sort detail rows inside every employee group.
 *
 * Name sorting always keeps dates ASC, as requested.
 *
 * Date sorting uses the requested direction.
 */
function sortGroupDetails(group: ReviewTableRow[], direction: "asc" | "desc") {
  const details = group.filter(
    (row): row is ReviewDetailRow => row.rowType === "detail",
  );

  const summaries = group.filter(
    (row): row is ReviewSummaryRow => row.rowType === "summary",
  );

  details.sort((a, b) => {
    const result = a.date.localeCompare(b.date);

    return direction === "asc" ? result : -result;
  });

  return [...details, ...summaries];
}

/**
 * Custom grouped sorting.
 *
 * Rules:
 *
 * Name ASC
 *   Employee groups -> name ASC
 *   Details -> date ASC
 *
 * Name DESC
 *   Employee groups -> name DESC
 *   Details -> date ASC
 *
 * Date ASC
 *   Employee groups -> earliest date ASC
 *   Details -> date ASC
 *
 * Date DESC
 *   Employee groups -> latest date DESC
 *   Details -> date DESC
 */
function sortReviewRows(
  rows: ReviewTableRow[],
  sorting: LateHubSorting,
): ReviewTableRow[] {
  const groups = groupRows(rows);

  if (!sorting) {
    return groups.map((group) => sortGroupDetails(group, "asc")).flat();
  }

  if (sorting.column === "employeeName") {
    groups.sort((a, b) => {
      const aDetail = a.find(
        (row): row is ReviewDetailRow => row.rowType === "detail",
      );

      const bDetail = b.find(
        (row): row is ReviewDetailRow => row.rowType === "detail",
      );

      const aName = aDetail?.employeeName ?? "";
      const bName = bDetail?.employeeName ?? "";

      const result = aName.localeCompare(bName, "vi", {
        sensitivity: "base",
        numeric: true,
      });

      return sorting.direction === "asc" ? result : -result;
    });

    // IMPORTANT:
    // Name sorting always keeps dates ASC.
    return groups.map((group) => sortGroupDetails(group, "asc")).flat();
  }

  if (sorting.column === "date") {
    groups.sort((a, b) => {
      const aDetails = a.filter(
        (row): row is ReviewDetailRow => row.rowType === "detail",
      );

      const bDetails = b.filter(
        (row): row is ReviewDetailRow => row.rowType === "detail",
      );

      if (aDetails.length === 0) {
        return 1;
      }

      if (bDetails.length === 0) {
        return -1;
      }

      /**
       * ASC  -> earliest date determines group position
       * DESC -> latest date determines group position
       */
      const aDate =
        sorting.direction === "asc"
          ? aDetails[0].date
          : aDetails[aDetails.length - 1].date;

      const bDate =
        sorting.direction === "asc"
          ? bDetails[0].date
          : bDetails[bDetails.length - 1].date;

      const result = aDate.localeCompare(bDate);

      if (result !== 0) {
        return sorting.direction === "asc" ? result : -result;
      }

      /**
       * Stable secondary sort by employee name.
       * This prevents groups with the same date from jumping
       * around between renders.
       */
      const aName = aDetails[0].employeeName;
      const bName = bDetails[0].employeeName;

      return aName.localeCompare(bName, "vi", {
        sensitivity: "base",
        numeric: true,
      });
    });

    return groups
      .map((group) => sortGroupDetails(group, sorting.direction))
      .flat();
  }

  return rows;
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

const features = tableFeatures(stockFeatures);

export type UseLateHubTableOptions = {
  data: WorkforceImportResult;
  columns: Array<ColumnDef<typeof features, ReviewTableRow>>;
  initialState?: Partial<TableState<typeof stockFeatures>>;
};

export function useLateHubTable({
  data,
  columns,
  initialState,
}: UseLateHubTableOptions) {
  const [sorting, setSorting] = useState<LateHubSorting>(null);

  /**
   * Sorting happens before the data reaches TanStack Table.
   *
   * We intentionally don't use TanStack's built-in sorting because
   * ReviewTableRow contains two logical row types:
   *
   *   detail
   *   summary
   *
   * Normal row sorting would allow a summary row to separate from
   * its employee's detail rows.
   */
  const sortedData = useMemo(() => {
    return sortReviewRows(buildReviewRows(data), sorting);
  }, [data, sorting]);

  const table = useTable({
    features,
    data: sortedData,
    columns,
    initialState,
  });

  /**
   * Header sort behavior:
   *
   * First click:
   *   ASC
   *
   * Second click:
   *   DESC
   *
   * Third click:
   *   clear sorting
   */
  function toggleSort(column: string) {
    setSorting((current) => {
      if (!current || current.column !== column) {
        return {
          column,
          direction: "asc",
        };
      }

      if (current.direction === "asc") {
        return {
          column,
          direction: "desc",
        };
      }

      return null;
    });
  }

  function clearSort() {
    setSorting(null);
  }

  function getSortDirection(column: string) {
    if (sorting?.column !== column) {
      return undefined;
    }

    return sorting.direction;
  }

  function isSorted(column: string) {
    return sorting?.column === column;
  }

  return {
    table,
    sorting,
    sortedData,

    toggleSort,
    clearSort,

    getSortDirection,
    isSorted,
  };
}
