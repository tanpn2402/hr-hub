import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { getEmployees } from '../api/employees';
import { getErrorMessage, type WebAppAccessRequest } from '../api/web-apps';
import { getIdentityUser, type IdentityUser } from '../api/identity';

type Props = {
  request: WebAppAccessRequest | null;
  onClose: () => void;
  onAssignRoles: (user: IdentityUser) => void;
};

export function AccessRequesterDialog({ request, onClose, onAssignRoles }: Props) {
  const { t } = useTranslation();
  const userQuery = useQuery({
    queryKey: ['identity-user', request?.requesterId],
    queryFn: () => getIdentityUser(request!.requesterId),
    enabled: Boolean(request),
  });
  const employeesQuery = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees,
    enabled: Boolean(request),
  });

  const user = userQuery.data;
  const employee = employeesQuery.data?.find((item) => item.referenceId === request?.requesterId);

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('access_request_requester_details')}</DialogTitle>
        </DialogHeader>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t('integrated_user_details')}</h3>
          {userQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{t('loading_accounts')}</p>
          ) : userQuery.isError ? (
            <p className="text-sm text-destructive">
              {getErrorMessage(userQuery.error, t('failed_to_load_accounts'))}
            </p>
          ) : user ? (
            <div className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-2">
              <Detail label={t('username')} value={user.username} />
              <Detail label={t('email')} value={user.email} />
              <Detail label={t('first_name')} value={user.firstName} />
              <Detail label={t('last_name')} value={user.lastName} />
              <Detail label={t('status')} value={t(user.enabled ? 'enabled' : 'disabled')} />
              <Detail label={t('email_verified')} value={t(user.emailVerified ? 'yes' : 'no')} />
              <div className="space-y-1 sm:col-span-2">
                <div className="text-xs text-muted-foreground">{t('roles')}</div>
                {user.roles?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((role) => (
                      <Badge key={role} variant="secondary">
                        {role}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">{t('no_assigned_roles')}</span>
                )}
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t('linked_employee_details')}</h3>
          {employeesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{t('loading_employees')}</p>
          ) : employeesQuery.isError ? (
            <p className="text-sm text-destructive">
              {getErrorMessage(employeesQuery.error, t('failed_to_load_employees'))}
            </p>
          ) : employee ? (
            <div className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-2">
              <Detail label={t('name')} value={employee.name} />
              <Detail label={t('employee_code')} value={employee.employeeCode} />
              <Detail label={t('email')} value={employee.email} />
              <Detail label={t('phone')} value={employee.phone} />
              <Detail label={t('department')} value={employee.department} />
              <Detail label={t('position')} value={employee.position} />
              <Detail label={t('status')} value={t(employee.active ? 'active' : 'disabled')} />
            </div>
          ) : (
            <p className="rounded-md border p-3 text-sm text-muted-foreground">
              {t('no_linked_employee')}
            </p>
          )}
        </section>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
          <Button
            type="button"
            disabled={!user || userQuery.isLoading || userQuery.isError}
            onClick={() => user && onAssignRoles(user)}
          >
            {t('assign_roles')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="break-words">{value || '—'}</div>
    </div>
  );
}
