import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createWebApp,
  deleteWebApp,
  getWebApp,
  getWebApps,
  getWebAppVersions,
  publishWebAppVersion,
  rollbackWebAppVersion,
  setWebAppEnabled,
  updateWebApp,
  uploadWebAppVersion,
} from '../api/web-apps';

export const webAppsQueryKey = ['web-apps'] as const;

/** Apps the API returns for the caller: all for admins, role-filtered published apps otherwise, public apps when anonymous. */
export function useWebApps() {
  return useQuery({ queryKey: webAppsQueryKey, queryFn: getWebApps });
}

export function useWebApp(id: string | undefined) {
  return useQuery({
    queryKey: [...webAppsQueryKey, id],
    queryFn: () => getWebApp(id!),
    enabled: Boolean(id),
  });
}

export function useWebAppVersions(id: string | undefined) {
  return useQuery({
    queryKey: [...webAppsQueryKey, id, 'versions'],
    queryFn: () => getWebAppVersions(id!),
    enabled: Boolean(id),
  });
}

/** Every mutation refreshes the list, the detail and the versions of web apps. */
function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: webAppsQueryKey });
}

export function useCreateWebApp() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: createWebApp, onSuccess: invalidate });
}

export function useUpdateWebApp() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: updateWebApp, onSuccess: invalidate });
}

export function useDeleteWebApp() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: deleteWebApp, onSuccess: invalidate });
}

export function useUploadWebAppVersion() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: uploadWebAppVersion, onSuccess: invalidate });
}

export function usePublishWebAppVersion() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => publishWebAppVersion(id, version),
    onSuccess: invalidate,
  });
}

export function useRollbackWebAppVersion() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => rollbackWebAppVersion(id, version),
    onSuccess: invalidate,
  });
}

export function useSetWebAppEnabled() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => setWebAppEnabled(id, enabled),
    onSuccess: invalidate,
  });
}
