export interface AttendanceRecord {
  employeeCode: string;
  employeeName: string;
  date: string; // ISO yyyy-MM-dd
  checkIn: Date | null;
  checkOut: Date | null;
}
