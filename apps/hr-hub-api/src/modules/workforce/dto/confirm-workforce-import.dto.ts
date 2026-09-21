export interface OverrideWorkforceRowDto {
  rowId: string;
  employeeCode?: string;
  employeeName?: string | null;
  date?: string;
  checkIn?: string | null;
  checkOut?: string | null;
  note?: string | null;
  fineAmount?: number;
}

export interface ConfirmWorkforceImportDto {
  overrideRows?: OverrideWorkforceRowDto[];
}
