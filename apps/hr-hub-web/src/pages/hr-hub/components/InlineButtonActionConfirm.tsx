import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Props = {
  open: boolean;
  isLoading?: boolean;
  title: string;
  description?: string;
  button: React.ReactElement;
  cancelText: string;
  confirmText: string;
  cancelAction: () => void;
  confirmAction: () => void;
};

export function InlineButtonActionConfirm({
  open,
  button,
  cancelText,
  confirmText,
  isLoading,
  title,
  description,
  cancelAction,
  confirmAction,
}: Props) {
  return (
    <Popover
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          cancelAction();
        }
      }}
    >
      <PopoverTrigger render={button} />

      <PopoverContent side="bottom" align="end" className="w-64">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">{title}</p>

            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="xs"
              className="min-w-20"
              onClick={() => cancelAction()}
              disabled={isLoading}
            >
              {cancelText}
            </Button>

            <Button
              variant="default"
              className="min-w-20"
              size="xs"
              onClick={() => confirmAction()}
              disabled={isLoading}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
