import { ShippingDetails, PaymentDetails } from './checkout';

export const ORDER_STATUSES = ['pending', 'confirmed', 'shipped'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function getNextOrderStatus(status: OrderStatus): OrderStatus | null {
  const currentIndex = ORDER_STATUSES.indexOf(status);
  if (currentIndex < 0 || currentIndex === ORDER_STATUSES.length - 1) {
    return null;
  }

  return ORDER_STATUSES[currentIndex + 1];
}

export interface OrderItem {
  productId: number;
  title: string;
  price: number;
  quantity: number;
  imageUrl: string;
}

export interface Order {
  id: string | number;
  orderNumber: string;
  userId: string;
  userName: string;
  tenantId: string;
  createdAt: string;
  status: OrderStatus;
  subtotal: number;
  total: number;
  totalItems: number;
  shippingAddress: ShippingDetails;
  paymentMethod: PaymentDetails['method'];
  items: OrderItem[];
  isSeeded?: boolean;
}

export type NewOrder = Omit<Order, 'id'>;
