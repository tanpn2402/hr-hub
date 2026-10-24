import { useMemo, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Eye } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  columnVisibilityFeature,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

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
  decideWebAppAccessRequest,
  getErrorMessage,
  getWebAppAccessRequests,
  type AccessRequestDecision,
  type WebAppAccessRequest,
} from '../api/web-apps';
import type { IdentityUser } from '../api/identity';
import { AccessRequesterDialog } from '../components/AccessRequesterDialog';
import { RoleAssignmentDialog } from '../components/IdentityDialogs';
import { WebAppAccessRequestDialog } from '../components/WebAppAccessRequestDialog';
import { HRPageHeader } from '../components/HRPageHeader';

const features = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

const ACCESS_REQUESTS_QUERY_KEY = ['web-apps', 'access-requests'];

export function WebAppAccessRequestsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<WebAppAccessRequest | null>(null);
  const [requesterDetails, setRequesterDetails] = useState<WebAppAccessRequest | null>(null);
  const [assigningRoles, setAssigningRoles] = useState<IdentityUser | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'requestedAt', desc: true }]);

  const query = useQuery({
    queryKey: ACCESS_REQUESTS_QUERY_KEY,
    queryFn: getWebAppAccessRequests,
  });

  const decision = useMutation({
    mutationFn: ({ id, value, note }: { id: string; value: AccessRequestDecision; note: string }) =>
      decideWebAppAccessRequest(id, value, note),
    onSuccess: () => {
      toast.success(t('access_request_decision_saved'));
      setSelectedRequest(null);
      void queryClient.invalidateQueries({ queryKey: ACCESS_REQUESTS_QUERY_KEY });
    },
    onError: (error) => toast.error(getErrorMessage(error, t('access_request_decision_failed'))),
  });

  const data = query.data ?? [];
  const columns = useMemo<Array<ColumnDef<typeof features, WebAppAccessRequest>>>(
    () => [
      {
        id: 'requestedAt',
        accessorFn: (row) => row.requestedAt,
        header: t('access_request_requested_at'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {dayjs(row.original.requestedAt).locale('vi').format('DD MMM YYYY, HH:mm')}
          </span>
        ),
      },
      {
        id: 'appName',
        accessorFn: (row) => row.appName,
        header: t('web_apps'),
        cell: ({ row }) => (
          <button
            type="button"
            className="text-left hover:underline"
            onClick={() => navigate(`/hr-hub/apps-admin/web-apps/${row.original.webAppId}`)}
          >
            <div className="font-medium">{row.original.appName}</div>
            <div className="font-mono text-xs text-muted-foreground">{row.original.appSlug}</div>
          </button>
        ),
      },
      {
        id: 'requester',
        accessorFn: (row) => row.requesterUsername || row.requesterEmail || row.requesterId,
        header: t('access_request_requester'),
        cell: ({ row }) => (
          <button
            type="button"
            className="text-left hover:underline"
            onClick={() => setRequesterDetails(row.original)}
          >
            <div className="font-medium">
              {row.original.requesterUsername ||
                row.original.requesterEmail ||
                row.original.requesterId}
            </div>
            {row.original.requesterEmail && (
              <div className="text-xs text-muted-foreground">{row.original.requesterEmail}</div>
            )}
          </button>
        ),
      },
      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: t('status'),
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'pending' ? 'outline' : 'secondary'}>
            {t(row.original.status)}
          </Badge>
        ),
      },
      {
        id: 'actions',
        enableSorting: false,
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(row.original)}>
              <Eye className="mr-2 size-4" />
              {t('view')}
            </Button>
          </div>
        ),
      },
    ],
    [navigate, t],
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
      <HRPageHeader title={t('manage_access')} description={t('manage_access_description')} />

      <div className="px-6 pb-8">
        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
          {query.isLoading ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              {t('loading_access_requests')}
            </div>
          ) : query.isError ? (
            <div className="flex h-32 items-center justify-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {getErrorMessage(query.error, t('failed_to_load_access_requests'))}
            </div>
          ) : !data.length ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              {t('no_access_requests')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="h-9 whitespace-nowrap">
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
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

      <WebAppAccessRequestDialog
        request={selectedRequest}
        isPending={decision.isPending}
        onOpenChange={(open) => !open && !decision.isPending && setSelectedRequest(null)}
        onDecide={(value, note) => {
          if (!selectedRequest) return;
          decision.mutate({ id: selectedRequest.id, value, note });
        }}
      />
      <AccessRequesterDialog
        request={requesterDetails}
        onClose={() => setRequesterDetails(null)}
        onAssignRoles={(user) => {
          setRequesterDetails(null);
          setAssigningRoles(user);
        }}
      />
      {assigningRoles && (
        <RoleAssignmentDialog user={assigningRoles} onClose={() => setAssigningRoles(null)} />
      )}
    </div>
  );
}
