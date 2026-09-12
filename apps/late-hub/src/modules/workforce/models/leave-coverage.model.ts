export interface LeaveCoverage {
  morning: boolean;
  afternoon: boolean;
}

/** Keyed by `${employeeCode}|${date}` (date as ISO yyyy-MM-dd). */
export type LeaveCoverageMap = Map<string, LeaveCoverage>;

export function leaveCoverageKey(employeeCode: string, date: string): string {
  return `${employeeCode}|${date}`;
}
