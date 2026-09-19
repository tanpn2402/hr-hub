import { useMutation } from "@tanstack/react-query";
import { importWorkforceFiles } from "../api/workforce";

export function useImportWorkforce() {
  return useMutation({
    mutationFn: ({
      attendanceFile,
      leaveFile,
    }: {
      attendanceFile: File;
      leaveFile: File;
    }) => importWorkforceFiles({ attendanceFile, leaveFile }),
  });
}
