import { ShippingDetails, PaymentDetails } from './checkout';

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
  status: 'placed' | 'processing' | 'shipped' | 'delivered';
  subtotal: number;
  total: number;
  totalItems: number;
  shippingAddress: ShippingDetails;
  paymentMethod: PaymentDetails['method'];
  items: OrderItem[];
  isSeeded?: boolean;
}

export type NewOrder = Omit<Order, 'id'>;
