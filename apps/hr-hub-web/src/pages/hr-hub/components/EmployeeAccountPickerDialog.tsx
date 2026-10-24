import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { updateEmployee, type Employee } from '../api/employees';
import { getIdentityUsers } from '../api/identity';
import { employeesQueryKey } from '../hooks/useEmployees';

export function EmployeeAccountPickerDialog({
  employee,
  onClose,
}: {
  employee: Employee;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { register, watch } = useForm({ defaultValues: { email: employee.email ?? '' } });
  const email = watch('email');
  const accounts = useQuery({
    queryKey: ['identity-users', 'email', email],
    queryFn: () => getIdentityUsers({ email, page: 1, limit: 20 }),
  });
  const link = useMutation({
    mutationFn: (referenceId: string | null) => updateEmployee(employee.id, { referenceId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: employeesQueryKey });
      toast.success(t('integrated_account_updated'));
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('could_not_link_account')),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('integrated_account_for', { name: employee.name })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('identity_account_search_help')}</p>
          <Input type="email" placeholder={t('filter_by_email')} {...register('email')} />
          {accounts.isLoading ? (
            <p className="text-sm text-muted-foreground">{t('searching_accounts')}</p>
          ) : accounts.isError ? (
            <p className="text-sm text-destructive">{t('failed_to_load_accounts')}</p>
          ) : (
            <div className="max-h-64 overflow-auto rounded-md border">
              {accounts.data?.users.length ? (
                accounts.data.users.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    disabled={link.isPending}
                    className="flex w-full items-center justify-between border-b px-3 py-3 text-left text-sm last:border-0 hover:bg-muted disabled:opacity-50"
                    onClick={() => link.mutate(account.id)}
                  >
                    <span>
                      <strong>{account.username}</strong>
                      <span className="ml-2 text-muted-foreground">
                        {account.email ?? t('no_email')}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">{t('select')}</span>
                  </button>
                ))
              ) : (
                <p className="p-4 text-sm text-muted-foreground">{t('no_accounts_found')}</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="min-w-32"
            onClick={() => link.mutate(null)}
            disabled={link.isPending}
          >
            {t('unlink')}
          </Button>
          <Button variant="outline" className="min-w-32" onClick={onClose}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
