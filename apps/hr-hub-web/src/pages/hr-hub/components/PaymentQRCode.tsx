import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentQRCodeProps {
  qrCodeUrl: string;
  completed: boolean;
}

export function PaymentQRCode({ qrCodeUrl, completed }: PaymentQRCodeProps) {
  return (
    <div className="relative flex h-64 w-64 items-center justify-center">
      {/* QR Code */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center',
          'transition-all duration-500 ease-in-out',
          completed ? 'scale-100 opacity-100' : 'scale-100 opacity-100',
        )}
      >
        <img
          src={qrCodeUrl}
          alt="Payment QR Code"
          className="h-full w-full rounded-lg object-contain"
        />
      </div>

      {/* Success */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center',
          'transition-all duration-500 ease-out',
          completed ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
        )}
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-500">
          <Check
            className={cn(
              'h-12 w-12 text-white',
              completed && 'animate-[check_0.4s_ease-out_0.3s_both]',
            )}
            strokeWidth={3}
          />
        </div>
      </div>
    </div>
  );
}
