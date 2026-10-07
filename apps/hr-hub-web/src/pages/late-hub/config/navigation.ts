import { LateHubIndexPage } from '../pages/LateHubIndexPage';
import { LateHubPaymentPage } from '../pages/LateHubPaymentPage';

export type LateHubRoutes = {
  id: string;
  label: string;
  path: string;
  component: React.ComponentType;
  children?: LateHubRoutes[];
};

export const lateHubRoutes: LateHubRoutes[] = [
  {
    id: 'index',
    label: 'index',
    path: '',
    component: LateHubIndexPage,
  },
  {
    id: 'payment',
    label: 'payment-index',
    path: 'payment',
    component: LateHubPaymentPage,
  },
  {
    id: 'payment-detail',
    label: 'Payment Detail',
    path: 'payment/:paymentId',
    component: LateHubPaymentPage,
  },
];
