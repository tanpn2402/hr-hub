import { ArrowDown, ArrowUp, ArrowUpDown, Link2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  columnVisibilityFeature,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Employee } from '../api/employees';
import { HRPageHeader } from '../components/HRPageHeader';
import { EmployeeAccountPickerDialog } from '../components/EmployeeAccountPickerDialog';
import { useEmployees } from '../hooks/useEmployees';

const features = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

export function EmployeesPage() {
  const { t } = useTranslation();
  const employees = useEmployees();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const data = employees.data ?? [];
  const columns = useMemo<ColumnDef<typeof features, Employee>[]>(
    () => [
      {
        accessorKey: 'employeeCode',
        header: t('employee_code'),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.employeeCode}</span>,
      },
      {
        accessorKey: 'name',
        header: t('name'),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'email',
        header: t('email'),
        cell: ({ row }) => row.original.email || '—',
      },
      {
        accessorKey: 'department',
        header: t('department'),
        cell: ({ row }) => row.original.department || '—',
      },
      {
        accessorKey: 'referenceId',
        header: t('identity_account'),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.referenceId || t('not_linked')}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setEmployee(row.original)}>
              <Link2 className="mr-2 size-4" />
              {t('integrated_account')}
            </Button>
          </div>
        ),
      },
    ],
    [t],
  );
  const table = useTable({
    features,
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <div>
      <HRPageHeader title={t('master_data')} description={t('employees_description')} />
      <div className="p-6">
        <div className="overflow-hidden rounded-xl border bg-card">
          {employees.isLoading ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              {t('loading_employees')}
            </div>
          ) : employees.isError ? (
            <div className="flex h-32 items-center justify-center text-sm text-destructive">
              {t('failed_to_load_employees')}
            </div>
          ) : !data.length ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              {t('no_employees_found')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="h-8 whitespace-nowrap">
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="flex items-center gap-1 text-left text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            <table.FlexRender header={header} />
                            {header.column.getIsSorted() === 'asc' ? (
                              <ArrowUp className="size-3" />
                            ) : header.column.getIsSorted() === 'desc' ? (
                              <ArrowDown className="size-3" />
                            ) : (
                              <ArrowUpDown className="size-3 opacity-40" />
                            )}
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
      {employee && (
        <EmployeeAccountPickerDialog employee={employee} onClose={() => setEmployee(null)} />
      )}
    </div>
  );
}
