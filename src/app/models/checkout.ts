import { Product } from './product';

export interface ShippingDetails {
  fullName: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
}

export interface PaymentDetails {
  method: 'card' | 'paypal';
  cardLast4?: string;
}

export interface CheckoutRequest {
  items: Product[];
  total: number;
  shipping: ShippingDetails;
  payment: PaymentDetails;
}

export type CheckoutFailureReason =
  | 'CHECKOUT_UNAVAILABLE'
  | 'PRODUCT_NOT_FOUND'
  | 'INSUFFICIENT_STOCK'
  | 'STOCK_CHANGED'
  | 'RESERVATION_EXPIRED'
  | 'PAYMENT_DECLINED'
  | 'INVALID_SHIPPING';

export interface CheckoutFailure {
  reason: CheckoutFailureReason;
  message: string;
  productId?: number;
  requestedQuantity?: number;
  availableQuantity?: number;
}

export class CheckoutError extends Error {
  constructor(public readonly failure: CheckoutFailure) {
    super(failure.message);
    this.name = 'CheckoutError';
  }
}

export function isCheckoutError(error: unknown): error is CheckoutError {
  return error instanceof CheckoutError;
}

export interface CheckoutConfirmation {
  orderId: string;
  placedAtIso: string;
  total: number;
  itemCount: number;
  etaDays: number;
}
