import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateEmployee } from '../api/employees';
import {
  assignIdentityUserRoles,
  createIdentityRole,
  createIdentityUser,
  getIdentityRoles,
  type IdentityRole,
  type IdentityUser,
  updateIdentityRole,
  updateIdentityUser,
} from '../api/identity';
import { employeesQueryKey, useEmployees } from '../hooks/useEmployees';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

type AccountFormValues = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  enabled: boolean;
};

export function AccountDialog({
  account,
  onClose,
}: {
  account: IdentityUser | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountFormValues>({
    defaultValues: {
      username: account?.username ?? '',
      email: account?.email ?? '',
      firstName: account?.firstName ?? '',
      lastName: account?.lastName ?? '',
      password: '',
      enabled: account?.enabled ?? true,
    },
  });
  const save = useMutation({
    mutationFn: (values: AccountFormValues) => {
      const { password, ...userValues } = values;
      const input = account && !password ? userValues : values;
      return account ? updateIdentityUser(account.id, input) : createIdentityUser(input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['identity-users'] });
      toast.success(t('identity_account_saved'));
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, t('could_not_save_account'))),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? t('edit_account_title') : t('new_account')}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4 py-2"
          onSubmit={handleSubmit((values) => save.mutate(values))}
          noValidate
        >
          <div className="grid gap-2">
            <Label htmlFor="identity-username">{t('username')}</Label>
            <Input
              id="identity-username"
              aria-invalid={!!errors.username}
              {...register('username', { required: t('username_required') })}
            />
            <FieldError errors={[errors.username]} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="identity-email">{t('email')}</Label>
            <Input id="identity-email" type="email" {...register('email')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="identity-first-name">{t('first_name')}</Label>
            <Input id="identity-first-name" {...register('firstName')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="identity-last-name">{t('last_name')}</Label>
            <Input id="identity-last-name" {...register('lastName')} />
          </div>
          {!account && (
            <div className="grid gap-2">
              <Label htmlFor="identity-password">{t('initial_password')}</Label>
              <Input
                id="identity-password"
                type="password"
                aria-invalid={!!errors.password}
                {...register('password', { required: t('password_required') })}
              />
              <FieldError errors={[errors.password]} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className="min-w-32" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={save.isPending} className="min-w-32">
              {save.isPending ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RoleAssignmentDialog({
  user,
  onClose,
}: {
  user: IdentityUser;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const roles = useQuery({ queryKey: ['identity-roles'], queryFn: getIdentityRoles });
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<{ roleNames: string[] }>({
    defaultValues: { roleNames: user.roles ?? [] },
  });
  const assign = useMutation({
    mutationFn: (roleNames: string[]) => assignIdentityUserRoles(user.id, roleNames),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['identity-users'] });
      void queryClient.invalidateQueries({ queryKey: ['identity-user', user.id] });
      toast.success(t('identity_roles_assigned'));
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, t('could_not_assign_roles'))),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('assign_roles_to_account', { name: user.username })}</DialogTitle>
        </DialogHeader>
        {roles.isLoading ? (
          <p className="py-4 text-sm text-muted-foreground">{t('loading_roles')}</p>
        ) : roles.isError ? (
          <p className="py-4 text-sm text-destructive">{t('failed_to_load_roles')}</p>
        ) : !roles.data?.length ? (
          <p className="py-4 text-sm text-muted-foreground">{t('no_roles_found')}</p>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={handleSubmit(({ roleNames }) => assign.mutate(roleNames))}
            noValidate
          >
            <Controller
              control={control}
              name="roleNames"
              rules={{
                validate: (selected) => selected.length > 0 || t('select_at_least_one_role'),
              }}
              render={({ field }) => (
                <div className="max-h-72 space-y-2 overflow-auto rounded-md border p-3">
                  {roles.data.map((role) => (
                    <label key={role.id} className="flex items-center gap-3 text-sm">
                      <Checkbox
                        checked={field.value.includes(role.name)}
                        onCheckedChange={(checked) => {
                          const selected = field.value;
                          field.onChange(
                            checked
                              ? [...selected, role.name]
                              : selected.filter((name) => name !== role.name),
                          );
                        }}
                        aria-label={role.name}
                      />
                      <span>
                        <span className="font-medium">{role.name}</span>
                        {role.description && (
                          <span className="block text-muted-foreground">{role.description}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            />
            <FieldError errors={[errors.roleNames]} />
            <DialogFooter>
              <Button type="button" variant="outline" className="min-w-32" onClick={onClose}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={assign.isPending} className="min-w-32">
                {assign.isPending ? t('saving') : t('assign_roles')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function EmployeeLinkDialog({ user, onClose }: { user: IdentityUser; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const employees = useEmployees();
  const { register, watch } = useForm({ defaultValues: { search: '' } });
  const search = watch('search').trim().toLocaleLowerCase();
  const linkedEmployee = employees.data?.find((employee) => employee.referenceId === user.id);
  const filteredEmployees =
    employees.data?.filter((employee) =>
      `${employee.employeeCode} ${employee.name} ${employee.email ?? ''}`
        .toLocaleLowerCase()
        .includes(search),
    ) ?? [];
  const link = useMutation({
    mutationFn: ({ employeeId, referenceId }: { employeeId: string; referenceId: string | null }) =>
      updateEmployee(employeeId, { referenceId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: employeesQueryKey });
      toast.success(t('employee_link_updated'));
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, t('could_not_link_employee'))),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('link_employee_to_account', { name: user.username })}</DialogTitle>
        </DialogHeader>
        {linkedEmployee && (
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>
              {t('employee_already_linked_to_account')} <strong>{linkedEmployee.name}</strong>
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-w-32"
              disabled={link.isPending}
              onClick={() => link.mutate({ employeeId: linkedEmployee.id, referenceId: null })}
            >
              {t('unlink_employee')}
            </Button>
          </div>
        )}
        <Input placeholder={t('search_employee')} {...register('search')} />
        {employees.isLoading ? (
          <p className="py-4 text-sm text-muted-foreground">{t('loading_employees')}</p>
        ) : employees.isError ? (
          <p className="py-4 text-sm text-destructive">{t('failed_to_load_employees')}</p>
        ) : !filteredEmployees.length ? (
          <p className="py-4 text-sm text-muted-foreground">{t('no_employees_found')}</p>
        ) : (
          <div className="max-h-72 overflow-auto rounded-md border">
            {filteredEmployees.map((employee) => {
              const alreadyLinked = Boolean(
                employee.referenceId && employee.referenceId !== user.id,
              );
              return (
                <button
                  key={employee.id}
                  type="button"
                  disabled={link.isPending || alreadyLinked || employee.id === linkedEmployee?.id}
                  className="flex w-full items-center justify-between border-b px-3 py-3 text-left text-sm last:border-0 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => link.mutate({ employeeId: employee.id, referenceId: user.id })}
                >
                  <span>
                    <strong>{employee.name}</strong>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {employee.employeeCode}
                    </span>
                    {employee.email && (
                      <span className="ml-2 text-muted-foreground">{employee.email}</span>
                    )}
                  </span>
                  {alreadyLinked && (
                    <span className="text-xs text-muted-foreground">
                      {t('employee_already_linked')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" className="min-w-32" onClick={onClose}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RoleDialog({ role, onClose }: { role: IdentityRole | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ name: string; description: string }>({
    defaultValues: { name: role?.name ?? '', description: role?.description ?? '' },
  });
  const save = useMutation({
    mutationFn: (values: { name: string; description: string }) =>
      role ? updateIdentityRole(role.name, values) : createIdentityRole(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['identity-roles'] });
      toast.success(t('identity_role_saved'));
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, t('could_not_save_role'))),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? t('edit_role_title') : t('new_role')}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4 py-2"
          onSubmit={handleSubmit((values) => save.mutate(values))}
          noValidate
        >
          <div className="grid gap-2">
            <Label htmlFor="identity-role-name">{t('role_name')}</Label>
            <Input
              id="identity-role-name"
              aria-invalid={!!errors.name}
              {...register('name', { required: t('role_name_required') })}
            />
            <FieldError errors={[errors.name]} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="identity-role-description">{t('description')}</Label>
            <Input id="identity-role-description" {...register('description')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-w-32" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={save.isPending} className="min-w-32">
              {save.isPending ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
