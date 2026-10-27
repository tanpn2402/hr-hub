import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import type { AccessRequestDecision, WebAppAccessRequest } from '../api/web-apps';

type Props = {
  request: WebAppAccessRequest | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onDecide: (decision: AccessRequestDecision, note: string) => void;
};

type FormValues = {
  note: string;
};

export function WebAppAccessRequestDialog({ request, isPending, onOpenChange, onDecide }: Props) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { note: '' },
  });

  useEffect(() => {
    reset({ note: '' });
  }, [request?.id, reset]);

  function submitDecision(decision: AccessRequestDecision) {
    void handleSubmit((values) => onDecide(decision, values.note))();
  }

  if (!request) return null;

  const decided = request.status !== 'pending';

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('access_request_detail')}</DialogTitle>
          <DialogDescription>
            {request.appName} · {request.appSlug}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid gap-1">
            <span className="text-muted-foreground">{t('access_request_requester')}</span>
            <span className="font-medium">
              {request.requesterUsername || request.requesterEmail || request.requesterId}
            </span>
            {request.requesterEmail && request.requesterUsername && (
              <span className="text-xs text-muted-foreground">{request.requesterEmail}</span>
            )}
          </div>

          <div className="grid gap-1">
            <span className="text-muted-foreground">{t('access_request_requested_at')}</span>
            <span>{dayjs(request.requestedAt).locale('vi').format('DD MMM YYYY, HH:mm')}</span>
          </div>

          <div className="grid gap-2">
            <span className="text-muted-foreground">{t('access_request_required_roles')}</span>
            {request.requiredRoles.length ? (
              <div className="flex flex-wrap gap-1">
                {request.requiredRoles.map((role) => (
                  <Badge key={role} variant="outline">
                    {role}
                  </Badge>
                ))}
              </div>
            ) : (
              <span>—</span>
            )}
          </div>

          <div className="grid gap-1">
            <span className="text-muted-foreground">{t('access_request_message')}</span>
            <p className="whitespace-pre-wrap rounded-md bg-muted p-3">{request.message || '—'}</p>
          </div>

          {decided && (
            <div className="rounded-md bg-muted p-3">
              <div className="font-medium">
                {t(request.status)}
                {request.decidedByName ? ` · ${request.decidedByName}` : ''}
              </div>
              {request.note && <p className="mt-1 whitespace-pre-wrap">{request.note}</p>}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="access-request-review-note">{t('access_request_review_note')}</Label>
            <Textarea
              id="access-request-review-note"
              maxLength={500}
              disabled={decided || isPending}
              placeholder={t('access_request_review_note_placeholder')}
              {...register('note')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
          <Button
            variant="destructive"
            disabled={decided || isPending}
            onClick={() => submitDecision('rejected')}
          >
            {t('reject')}
          </Button>
          <Button disabled={decided || isPending} onClick={() => submitDecision('approved')}>
            {t('allow')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
