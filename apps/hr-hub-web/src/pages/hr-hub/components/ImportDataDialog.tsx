import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useImportWorkforce } from "../hooks/useImportWorkforce";
import { WorkforceImportResult } from "./LateHubReviewTable";
import { LateHubReviewDialog } from "./LateHubReviewDialog";
import { useQueryClient } from "@tanstack/react-query";
import i18n from "@/locates";
import { useTranslation } from "react-i18next";

const excelFileSchema = z
  .instanceof(File)
  .refine(
    (file) =>
      /\.(xlsx|xls)$/i.test(file.name),
    i18n.t("only_excel_files_xlsx_xls_are_supported"),
  );

const importFilesSchema = z
  .array(excelFileSchema)
  .min(2, i18n.t("please_select_at_least_2_excel_files"));

type ImportFiles = {
  attendance: File;
  leave: File;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImportDataDialog({
  open,
  onOpenChange,
}: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const importMutation = useImportWorkforce();

  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [reviewData, setReviewData] = useState<WorkforceImportResult | null>(null);

  const [reviewOpen, setReviewOpen] = useState(false);

  const [classifiedFiles, setClassifiedFiles] =
    useState<ImportFiles | null>(null);

  const handleFilesChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles = Array.from(
      event.target.files ?? [],
    );

    setError(null);
    setClassifiedFiles(null);

    const result = importFilesSchema.safeParse(
      selectedFiles,
    );

    if (!result.success) {
      setFiles(selectedFiles);
      setError(result.error.issues[0]?.message ?? "Invalid files.");
      return;
    }

    const attendanceFiles = selectedFiles.filter((file) =>
      file.name.toUpperCase().includes("BCC"),
    );

    if (attendanceFiles.length === 0) {
      setFiles(selectedFiles);
      setError(
        'Attendance file must contain "BCC" in its filename.',
      );
      return;
    }

    if (attendanceFiles.length > 1) {
      setFiles(selectedFiles);
      setError(
        'Only one attendance file containing "BCC" is allowed.',
      );
      return;
    }

    const attendanceFile = attendanceFiles[0];

    const leaveFiles = selectedFiles.filter(
      (file) => file !== attendanceFile,
    );

    if (leaveFiles.length !== 1) {
      setFiles(selectedFiles);
      setError(
        "Please select exactly 2 files: one BCC attendance file and one leave file.",
      );
      return;
    }

    setFiles(selectedFiles);

    setClassifiedFiles({
      attendance: attendanceFile,
      leave: leaveFiles[0],
    });
  };

  const handleImport = () => {
    if (!classifiedFiles) {
      return;
    }

    setError(null);

    importMutation.mutate(
      {
        attendanceFile: classifiedFiles.attendance,
        leaveFile: classifiedFiles.leave,
      },
      {
        onSuccess: (result) => {
          setReviewData(result);
          setReviewOpen(true);

          onOpenChange(false);
          reset();

          queryClient.invalidateQueries({
            queryKey: ["workforce", "import-history"],
          });
        },

        onError: (error) => {
          console.error("Import failed:", error);

          setError(
            error instanceof Error
              ? error.message
              : "Failed to import workforce data.",
          );
        },
      },
    );
  };

  const reset = () => {
    setFiles([]);
    setError(null);
    setClassifiedFiles(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      reset();
    }

    onOpenChange(value);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
              <DialogTitle>
              {t("import_hr_data")}
            </DialogTitle>

            <DialogDescription>
              {t("select_at_least_two_excel_files_the_file_containing")}
              <span className="mx-1 font-medium text-foreground">
                BCC
              </span>
              {t("will_be_treated_as_attendance_details_the_other_file_will_be_treated_as_leave_details")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File picker */}
            <div
              className={[
                "rounded-lg border border-dashed p-6",
                "text-center transition-colors",
                "hover:bg-muted/50",
                error && "border-destructive",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".xlsx,.xls"
                className="hidden"
                id="hr-import-files"
                onChange={handleFilesChange}
                disabled={importMutation.isPending}
              />

              <label
                htmlFor="hr-import-files"
                className="flex cursor-pointer flex-col items-center"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Upload className="size-5 text-muted-foreground" />
                </div>

                <div className="mt-3 text-sm font-medium">
                  {t("choose_excel_files")}
                </div>

                <div className="mt-1 text-xs text-muted-foreground">
                  {t("select_attendance_and_leave_files")}
                </div>

                <div className="mt-3 rounded-md border px-3 py-1.5 text-xs font-medium">
                  {t("browse_files")}
                </div>
              </label>
            </div>

            {/* Validation error */}
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Selected files */}
            {files.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  {t("selected_files")}
                </div>

                {files.map((file) => {
                  const isAttendance =
                    file.name
                      .toUpperCase()
                      .includes("BCC");

                  return (
                    <div
                      key={`${file.name}-${file.size}`}
                      className="flex items-center gap-3 rounded-md border px-3 py-2"
                    >
                      <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {file.name}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </div>
                      </div>

                      <span
                        className={[
                          "shrink-0 rounded-full px-2 py-1 text-[11px] font-medium",
                          isAttendance
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                        ].join(" ")}
                      >
                        {isAttendance
                          ? t("attendance")
                          : t("leave")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Classification */}
            {classifiedFiles && (
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs font-medium text-muted-foreground">
                  {t("import_mapping")}
                </div>

                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t("attendance")}
                    </span>

                    <span className="truncate font-medium">
                      {classifiedFiles.attendance.name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t("leave")}
                    </span>

                    <span className="truncate font-medium">
                      {classifiedFiles.leave.name}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="min-w-32"
              onClick={() => handleOpenChange(false)}
              disabled={importMutation.isPending}
            >
              {t("cancel")}
            </Button>

            <Button
              className="min-w-32"
              disabled={!classifiedFiles || importMutation.isPending}
              onClick={handleImport}
            >
              {importMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}

              {t("import_data")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*  */}
      <LateHubReviewDialog
        open={reviewOpen}
        data={reviewData}
        onOpenChange={setReviewOpen}
      />
    </>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}