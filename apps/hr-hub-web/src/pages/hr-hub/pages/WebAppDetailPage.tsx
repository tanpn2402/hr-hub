import { ArrowLeft, ExternalLink, Loader2, Power, RotateCcw, Save, Upload, UploadCloud } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import dayjs from 'dayjs';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

import { formatBytes, getErrorMessage } from '../api/web-apps';
import { HRPageHeader } from '../components/HRPageHeader';
import { RolesInput } from '../components/RolesInput';
import { UploadWebAppVersionDialog } from '../components/UploadWebAppVersionDialog';
import { WebAppStatusBadge } from '../components/WebAppStatusBadge';
import {
  usePublishWebAppVersion,
  useRollbackWebAppVersion,
  useSetWebAppEnabled,
  useUpdateWebApp,
  useWebApp,
  useWebAppVersions,
} from '../hooks/useWebApps';

export function WebAppDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const appQuery = useWebApp(id);
  const versionsQuery = useWebAppVersions(id);
  const update = useUpdateWebApp();
  const publish = usePublishWebAppVersion();
  const rollback = useRollbackWebAppVersion();
  const toggle = useSetWebAppEnabled();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);

  const app = appQuery.data;

  useEffect(() => {
    if (!app) return;
    setName(app.name);
    setDescription(app.description ?? '');
    setRoles(app.requiredRoles);
  }, [app]);

  if (appQuery.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">{t('loading')}</div>;
  }

  if (!app) {
    return <div className="p-6 text-sm text-destructive">{getErrorMessage(appQuery.error, t('web_app_not_found'))}</div>;
  }

  const onError = (error: unknown) => toast.error(getErrorMessage(error));

  const save = () =>
    update.mutate(
      { id: app.id, name, description, requiredRoles: roles },
      { onSuccess: () => toast.success(t('saved')), onError },
    );

  const versions = versionsQuery.data ?? [];
  const busy = publish.isPending || rollback.isPending;

  return (
    <div>
      <HRPageHeader
        title={app.name}
        description={`/hr-hub/apps/${app.slug}/`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/hr-hub/apps-admin/web-apps')}>
              <ArrowLeft className="mr-2 size-4" />
              {t('back')}
            </Button>
            <Button
              variant="outline"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ id: app.id, enabled: app.status === 'disabled' }, { onError })}
            >
              <Power className="mr-2 size-4" />
              {app.status === 'disabled' ? t('enable') : t('disable')}
            </Button>
            <Button variant="outline" disabled={app.status !== 'published'} render={<Link to={`/hr-hub/apps/${app.slug}`} />}>
              <ExternalLink className="mr-2 size-4" />
              {t('open')}
            </Button>
          </>
        }
      />

      <div className="space-y-8 px-6 pb-8 pt-4">
        {/* Metadata */}
        <section className="max-w-2xl space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <WebAppStatusBadge status={app.status} />
            <span className="text-muted-foreground">
              {t('web_app_current_version')}: {app.currentVersion ? `v${app.currentVersion}` : '—'}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label>{t('name')}</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>{t('description')}</Label>
            <Textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>{t('web_app_required_roles')}</Label>
            <RolesInput value={roles} onChange={setRoles} />
          </div>

          <Button onClick={save} disabled={update.isPending || !name.trim()}>
            {update.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            {t('save')}
          </Button>
        </section>

        {/* Versions */}
        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">{t('web_app_versions')}</h3>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 size-4" />
              {t('upload_new_version')}
            </Button>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border bg-card">
            {versions.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                {t('no_versions_yet')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('version')}</TableHead>
                    <TableHead>{t('web_app_archive')}</TableHead>
                    <TableHead>{t('size')}</TableHead>
                    <TableHead>{t('note')}</TableHead>
                    <TableHead>{t('uploaded')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((version) => (
                    <TableRow key={version.id}>
                      <TableCell className="font-medium">
                        v{version.version}{' '}
                        {version.isCurrent && (
                          <Badge variant="secondary" className="ml-1">
                            {t('web_app_published')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="max-w-56 truncate">{version.archiveName}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {version.checksum.slice(0, 12)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatBytes(version.size)} · {version.fileCount} {t('files')}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-xs text-muted-foreground">
                        {version.note ?? ''}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {dayjs(version.createdAt).format('DD/MM/YYYY HH:mm')}
                        {version.createdByName ? ` · ${version.createdByName}` : ''}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {!version.isCurrent && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  publish.mutate(
                                    { id: app.id, version: version.version },
                                    { onSuccess: () => toast.success(t('web_app_published_toast')), onError },
                                  )
                                }
                              >
                                <UploadCloud className="mr-1 size-4" />
                                {t('publish')}
                              </Button>
                              {app.currentVersion !== null && version.version < app.currentVersion && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    rollback.mutate(
                                      { id: app.id, version: version.version },
                                      { onSuccess: () => toast.success(t('web_app_rolled_back')), onError },
                                    )
                                  }
                                >
                                  <RotateCcw className="mr-1 size-4" />
                                  {t('rollback')}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>
      </div>

      <UploadWebAppVersionDialog webAppId={app.id} open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
