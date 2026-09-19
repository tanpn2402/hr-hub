import { useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImportDataDialog({
  open,
  onOpenChange,
}: Props) {
  const [attendanceFile, setAttendanceFile] =
    useState<File | null>(null);

  const [leaveFile, setLeaveFile] =
    useState<File | null>(null);

  const canImport = attendanceFile && leaveFile;

  const handleImport = () => {
    if (!canImport) return;

    // TODO: upload files to backend
    console.log({
      attendanceFile,
      leaveFile,
    });

    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Import HR data
          </AlertDialogTitle>

          <AlertDialogDescription>
            Upload the attendance and leave Excel files for the
            selected period.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {/* Attendance */}
          <FileUploadBox
            title="Attendance details"
            description="Employee check-in / check-out details"
            file={attendanceFile}
            onFileChange={setAttendanceFile}
          />

          {/* Leave */}
          <FileUploadBox
            title="Leave details"
            description="Employee leave and absence details"
            file={leaveFile}
            onFileChange={setLeaveFile}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>
            Cancel
          </AlertDialogCancel>

          <Button
            disabled={!canImport}
            onClick={handleImport}
          >
            <Upload className="mr-2 size-4" />
            Import data
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type FileUploadBoxProps = {
  title: string;
  description: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
};

function FileUploadBox({
  title,
  description,
  file,
  onFileChange,
}: FileUploadBoxProps) {
  const inputId = title
    .toLowerCase()
    .replaceAll(" ", "-");

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <FileSpreadsheet className="size-4 text-muted-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">
            {title}
          </div>

          <div className="mt-0.5 text-xs text-muted-foreground">
            {description}
          </div>

          <label
            htmlFor={inputId}
            className="mt-3 flex cursor-pointer items-center justify-between rounded-md border border-dashed px-3 py-2.5 transition-colors hover:bg-muted"
          >
            <span className="min-w-0 truncate text-xs">
              {file ? (
                <span className="font-medium">
                  {file.name}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Choose Excel file
                </span>
              )}
            </span>

            <span className="ml-3 shrink-0 text-xs font-medium">
              Browse
            </span>
          </label>

          <input
            id={inputId}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const selectedFile =
                event.target.files?.[0] ?? null;

              onFileChange(selectedFile);
            }}
          />
        </div>
      </div>
    </div>
  );
}