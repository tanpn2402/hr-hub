export interface AttendanceRecord {
  employeeCode: string;
  employeeName: string;
  date: string; // ISO yyyy-MM-dd
  dayOfWeek: string; // Vietnamese label as found in the source file: Hai, Ba, Tư, Năm, Sáu, Bảy, CN
  checkIn: Date | null;
  checkOut: Date | null;
}
