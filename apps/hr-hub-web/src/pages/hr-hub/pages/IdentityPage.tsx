import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Link2,
  Pencil,
  Plus,
  ShieldPlus,
  Trash2,
} from 'lucide-react';
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

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  deleteIdentityRole,
  deleteIdentityUser,
  getIdentityRoles,
  getIdentityUsers,
  type IdentityRole,
  type IdentityUser,
} from '../api/identity';
import { InlineButtonActionConfirm } from '../components/InlineButtonActionConfirm';
import {
  AccountDialog,
  EmployeeLinkDialog,
  RoleAssignmentDialog,
  RoleDialog,
} from '../components/IdentityDialogs';
import { HRPageHeader } from '../components/HRPageHeader';

const features = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

export function IdentityPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'accounts' | 'roles'>('accounts');

  return (
    <div>
      <HRPageHeader
        title={t('integrated_identity')}
        description={t('integrated_identity_description')}
      />
      <div className="border-b px-6">
        <div className="flex gap-4">
          {(['accounts', 'roles'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`border-b-2 px-1 py-3 text-sm font-medium ${tab === item ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}
            >
              {item === 'accounts' ? t('accounts') : t('roles')}
            </button>
          ))}
        </div>
      </div>
      {tab === 'accounts' ? <AccountsTab /> : <RolesTab />}
    </div>
  );
}

function AccountsTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['identity-users'],
    queryFn: () => getIdentityUsers({ page: 1, limit: 100 }),
  });
  const [editing, setEditing] = useState<IdentityUser | null | undefined>(undefined);
  const [assigningRoles, setAssigningRoles] = useState<IdentityUser | null>(null);
  const [linkingEmployee, setLinkingEmployee] = useState<IdentityUser | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const remove = useMutation({
    mutationFn: deleteIdentityUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['identity-users'] });
      setDeletingUserId(null);
    },
  });
  const data = query.data?.users ?? [];
  const columns = useMemo<ColumnDef<typeof features, IdentityUser>[]>(
    () => [
      {
        accessorKey: 'username',
        header: t('username'),
        cell: ({ row }) => <span className="font-medium">{row.original.username}</span>,
      },
      {
        accessorKey: 'email',
        header: t('email'),
        cell: ({ row }) => row.original.email || '—',
      },
      {
        id: 'name',
        accessorFn: (row) => [row.firstName, row.lastName].filter(Boolean).join(' '),
        header: t('name'),
        cell: ({ row }) =>
          [row.original.firstName, row.original.lastName].filter(Boolean).join(' ') || '—',
      },
      {
        accessorKey: 'enabled',
        header: t('status'),
        cell: ({ row }) => (row.original.enabled ? t('enabled') : t('disabled')),
      },
      {
        id: 'roles',
        accessorFn: (row) => (row.roles ?? []).join(', '),
        header: t('roles'),
        cell: ({ row }) =>
          row.original.roles?.length ? (
            <div className="flex flex-wrap gap-1">
              {row.original.roles.map((role) => (
                <Badge key={role} variant="secondary">
                  {role.toLocaleUpperCase()}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">{t('no_assigned_roles')}</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('assign_roles_to_account', { name: row.original.username })}
              onClick={() => setAssigningRoles(row.original)}
            >
              <ShieldPlus className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('link_employee_to_account', { name: row.original.username })}
              onClick={() => setLinkingEmployee(row.original)}
            >
              <Link2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('edit_account', { name: row.original.username })}
              onClick={() => setEditing(row.original)}
            >
              <Pencil className="size-4" />
            </Button>
            <InlineButtonActionConfirm
              open={deletingUserId === row.original.id}
              cancelAction={() => setDeletingUserId(null)}
              confirmAction={() => remove.mutate(row.original.id)}
              cancelText={t('cancel')}
              confirmText={t('delete')}
              title={t('delete_account', { name: row.original.username })}
              description={t('this_action_cannot_be_undone')}
              isLoading={remove.isPending}
              button={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('delete_account', { name: row.original.username })}
                  disabled={remove.isPending}
                  onClick={() => setDeletingUserId(row.original.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              }
            />
          </div>
        ),
      },
    ],
    [deletingUserId, remove.isPending, t],
  );
  const table = useTable({
    features,
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <div className="p-6">
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing(null)}>
          <Plus className="mr-2 size-4" />
          {t('new_account')}
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {query.isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {t('loading_accounts')}
          </div>
        ) : query.isError ? (
          <div className="flex h-32 items-center justify-center text-sm text-destructive">
            {t('failed_to_load_accounts')}
          </div>
        ) : !data.length ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {t('no_accounts_found')}
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
      {editing !== undefined && (
        <AccountDialog account={editing} onClose={() => setEditing(undefined)} />
      )}
      {assigningRoles && (
        <RoleAssignmentDialog user={assigningRoles} onClose={() => setAssigningRoles(null)} />
      )}
      {linkingEmployee && (
        <EmployeeLinkDialog user={linkingEmployee} onClose={() => setLinkingEmployee(null)} />
      )}
    </div>
  );
}

function RolesTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['identity-roles'], queryFn: getIdentityRoles });
  const [editing, setEditing] = useState<IdentityRole | null | undefined>(undefined);
  const [deletingRoleName, setDeletingRoleName] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const remove = useMutation({
    mutationFn: deleteIdentityRole,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['identity-roles'] });
      setDeletingRoleName(null);
    },
  });
  const data = query.data ?? [];
  const columns = useMemo<ColumnDef<typeof features, IdentityRole>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('role'),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'description',
        header: t('description'),
        cell: ({ row }) => row.original.description || '—',
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('edit_role', { name: row.original.name })}
              onClick={() => setEditing(row.original)}
            >
              <Pencil className="size-4" />
            </Button>
            <InlineButtonActionConfirm
              open={deletingRoleName === row.original.name}
              cancelAction={() => setDeletingRoleName(null)}
              confirmAction={() => remove.mutate(row.original.name)}
              cancelText={t('cancel')}
              confirmText={t('delete')}
              title={t('delete_role', { name: row.original.name })}
              description={t('this_action_cannot_be_undone')}
              isLoading={remove.isPending}
              button={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('delete_role', { name: row.original.name })}
                  disabled={remove.isPending}
                  onClick={() => setDeletingRoleName(row.original.name)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              }
            />
          </div>
        ),
      },
    ],
    [deletingRoleName, remove.isPending, t],
  );
  const table = useTable({
    features,
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <div className="p-6">
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing(null)}>
          <Plus className="mr-2 size-4" />
          {t('new_role')}
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {query.isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {t('loading_roles')}
          </div>
        ) : query.isError ? (
          <div className="flex h-32 items-center justify-center text-sm text-destructive">
            {t('failed_to_load_roles')}
          </div>
        ) : !data.length ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {t('no_roles_found')}
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
      {editing !== undefined && <RoleDialog role={editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
