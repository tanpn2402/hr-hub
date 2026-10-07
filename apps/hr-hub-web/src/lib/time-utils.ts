import dayjs from 'dayjs';

export function dateOfWeek(value: string) {
  const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

  return dayNames[dayjs(value).day()];
}

/**
 *
 * @param month
 * @param format MMMM | MMMM, YYYY
 * @returns
 */
export function formatMonth(month: string, format = 'MMMM, YYYY') {
  return dayjs(month)
    .locale('vi')
    .format(format)
    .replace(/^./, (char) => char.toUpperCase());
}
