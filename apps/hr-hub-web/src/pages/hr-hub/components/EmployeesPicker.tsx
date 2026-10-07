import { Dispatch, SetStateAction, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { EmployeeSummary, WorkforceRow } from '../api/workforce';
import { useEmployees } from '../hooks/useEmployees';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type WorkforceImportResult = {
  batchId: string;
  month: string;
  status?: 'preview' | 'confirmed';
  rows: WorkforceRow[];
  employeeSummaries: EmployeeSummary[];
  grandTotal: number;
  paidAmount: number;
};

type Props = {
  multiple?: boolean;
  selectedEmployees: string[];
  setSelectedEmployees: Dispatch<SetStateAction<string[]>>;
};

export function EmployeesPicker({
  multiple = true,
  selectedEmployees,
  setSelectedEmployees,
}: Props) {
  const { t } = useTranslation();

  const { data: employees = [] } = useEmployees();

  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);

  const toggleEmployee = (employeeCode: string) => {
    setSelectedEmployees((current) => {
      return current.includes(employeeCode)
        ? current.filter((code) => code !== employeeCode)
        : !multiple
          ? [employeeCode]
          : [...current, employeeCode];
    });
  };

  const clearEmployees = () => {
    setSelectedEmployees([]);
  };

  return (
    <div className="flex items-center gap-1">
      <Popover open={employeePickerOpen} onOpenChange={setEmployeePickerOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={employeePickerOpen}
              className="h-8 min-w-55 justify-between text-xs"
            >
              <span className="truncate">
                {selectedEmployees.length === 0
                  ? t('select_employee')
                  : `${selectedEmployees.length} ${t('employees_selected')}`}
              </span>

              <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          }
        />

        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder={t('search_employee')} className="h-9" />

            <CommandList>
              <CommandEmpty>{t('no_employee_found')}</CommandEmpty>

              <CommandGroup>
                {employees.map((employee) => {
                  const selected = selectedEmployees.includes(employee.employeeCode);

                  return (
                    <CommandItem
                      key={employee.employeeCode}
                      value={`${employee.employeeCode} ${employee.name ?? ''}`}
                      onSelect={() => toggleEmployee(employee.employeeCode)}
                    >
                      <div
                        className={[
                          'mr-2 flex size-4.5 items-center justify-center rounded-sm border p-1',
                          selected ? 'bg-primary text-primary-foreground' : 'opacity-50',
                        ].join(' ')}
                      >
                        {selected && <Check className="size-3" />}
                      </div>

                      <div className="flex min-w-0 items-center gap-1">
                        <span className="text-xs font-mono font-medium text-primary relative top-0.5">
                          {employee.employeeCode}
                        </span>

                        <span className="truncate text-sm">
                          {employee.name || employee.employeeCode}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Clear filter */}
      {selectedEmployees.length > 0 ? (
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearEmployees}>
          <X className="mr-1 h-3.5 w-3.5" />
          {t('clear')}
        </Button>
      ) : null}
    </div>
  );
}
