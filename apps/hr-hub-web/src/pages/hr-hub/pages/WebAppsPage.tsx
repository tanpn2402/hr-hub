import { AlertCircle, ExternalLink, Eye, Plus, Power, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import dayjs from 'dayjs';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { getErrorMessage, type WebApp } from '../api/web-apps';
import { CreateWebAppDialog } from '../components/CreateWebAppDialog';
import { HRPageHeader } from '../components/HRPageHeader';
import { WebAppStatusBadge } from '../components/WebAppStatusBadge';
import { useDeleteWebApp, useSetWebAppEnabled, useWebApps } from '../hooks/useWebApps';

export function WebAppsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const query = useWebApps();
  const toggle = useSetWebAppEnabled();
  const remove = useDeleteWebApp();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<WebApp | null>(null);

  const apps = query.data ?? [];

  const handleToggle = (app: WebApp) =>
    toggle.mutate(
      { id: app.id, enabled: app.status === 'disabled' },
      { onError: (error) => toast.error(getErrorMessage(error)) },
    );

  const handleDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => toast.success(t('web_app_deleted')),
      onError: (error) => toast.error(getErrorMessage(error)),
      onSettled: () => setDeleting(null),
    });
  };

  return (
    <div>
      <HRPageHeader
        title={t('web_apps')}
        description={t('web_apps_description')}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            {t('create_web_app')}
          </Button>
        }
      />

      <div className="px-6 pb-8">
        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
          {query.isLoading ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              {t('loading')}
            </div>
          ) : query.isError ? (
            <div className="flex h-32 items-center justify-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {getErrorMessage(query.error)}
            </div>
          ) : apps.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              {t('no_web_apps_yet')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('web_app_slug')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('web_app_current_version')}</TableHead>
                  <TableHead>{t('web_app_required_roles')}</TableHead>
                  <TableHead>{t('updated')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>

              <TableBody>
                {apps.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">
                      <Link to={`/hr-hub/apps-admin/web-apps/${app.id}`} className="hover:underline">
                        {app.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{app.slug}</TableCell>
                    <TableCell>
                      <WebAppStatusBadge status={app.status} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {app.currentVersion ? `v${app.currentVersion}` : '—'}
                    </TableCell>
                    <TableCell>
                      {app.requiredRoles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">{t('web_app_public')}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {app.requiredRoles.map((role) => (
                            <Badge key={role} variant="outline">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dayjs(app.updatedAt).format('DD/MM/YYYY HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={app.status !== 'published'}
                          onClick={() => navigate(`/hr-hub/apps/${app.slug}`)}
                        >
                          <ExternalLink className="mr-1 size-4" />
                          {t('open')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/hr-hub/apps-admin/web-apps/${app.id}`)}
                        >
                          <Eye className="mr-1 size-4" />
                          {t('view')}
                        </Button>
                        <Button variant="ghost" size="sm" disabled={toggle.isPending} onClick={() => handleToggle(app)}>
                          <Power className="mr-1 size-4" />
                          {app.status === 'disabled' ? t('enable') : t('disable')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleting(app)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <CreateWebAppDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(app) => navigate(`/hr-hub/apps-admin/web-apps/${app.id}`)}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_web_app')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_web_app_description', { name: deleting?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
