/**
 * DTO Layer: Separates transport types from domain models.
 * DTOs represent what goes over the wire; domain models represent what the app uses.
 */

// ============================================================================
// Transport DTOs (what the backend/API returns)
// ============================================================================

export interface ProductDTO {
  id: number;
  title: string;
  price: number;
  stockCount: number | undefined;
  inStock: boolean;
}

export interface CartItemDTO {
  productId: number;
  title: string;
  price: number;
  quantity: number;
}

// ============================================================================
// Checkout Request & Response DTOs
// ============================================================================

export interface CheckoutRequestDTO {
  items: CartItemDTO[];
  total: number;
  shipping: {
    fullName: string;
    addressLine1: string;
    city: string;
    state: string;
    zip: string;
  };
  payment: {
    method: 'card' | 'paypal';
    cardLast4?: string;
  };
}

/**
 * Expanded typed failure reasons for stock safety and checkout reliability.
 */
export type CheckoutFailureReasonDTO =
  | 'CHECKOUT_UNAVAILABLE'  // Backend/service temporarily down
  | 'PRODUCT_NOT_FOUND'     // Product ID doesn't exist
  | 'INSUFFICIENT_STOCK'    // Not enough stock at time of check
  | 'STOCK_CHANGED'         // Stock changed between check and reserve
  | 'RESERVATION_EXPIRED'   // Reservation timed out or was cancelled
  | 'PAYMENT_DECLINED'      // Payment processing failed
  | 'INVALID_SHIPPING';     // Shipping address validation failed

export interface CheckoutFailureDTO {
  reason: CheckoutFailureReasonDTO;
  message: string;
  productId?: number;
  requestedQuantity?: number;
  availableQuantity?: number;
  retryable?: boolean;
}

export interface CheckoutSuccessDTO {
  orderId: string;
  placedAtIso: string;
  total: number;
  itemCount: number;
  etaDays: number;
}

export type CheckoutResponseDTO =
  | { status: 'success'; data: CheckoutSuccessDTO }
  | { status: 'failure'; data: CheckoutFailureDTO };

// ============================================================================
// Reservation DTOs (for atomic stock operations)
// ============================================================================

export interface ReservationItemDTO {
  productId: number;
  title: string;
  requestedQuantity: number;
}

export interface ReservationDTO {
  reservationId: string;
  createdAtIso: string;
  expiresAtIso: string;
  items: ReservationItemDTO[];
  status: 'active' | 'confirmed' | 'cancelled' | 'expired';
}

// ============================================================================
// Mappers: DTO ↔ Domain Model
// ============================================================================

import { Product } from './product';
import { ShippingDetails, PaymentDetails } from './checkout';

/**
 * Convert a domain Product to a ProductDTO for API transport.
 */
export function productToDTO(product: Product): ProductDTO {
  return {
    id: product.id,
    title: product.title,
    price: product.price,
    stockCount: product.stockCount,
    inStock: product.inStock,
  };
}

/**
 * Convert a ProductDTO from API to a domain Product.
 */
export function dtoToProduct(dto: ProductDTO): Product {
  return {
    id: dto.id,
    title: dto.title,
    description: '', // DTOs don't include description, use empty string
    price: dto.price,
    imageUrl: '', // DTOs don't include imageUrl, use empty string
    stockCount: dto.stockCount,
    inStock: dto.inStock,
    tenantId: 'tenant-a', // Default tenant for received DTOs
  };
}

/**
 * Convert cart items (Products) to CartItemDTOs for checkout request.
 */
export function cartItemsToDTO(items: Product[]): CartItemDTO[] {
  const grouped = new Map<number, CartItemDTO>();

  for (const item of items) {
    const key = item.id;
    if (grouped.has(key)) {
      const existing = grouped.get(key)!;
      existing.quantity += 1;
    } else {
      grouped.set(key, {
        productId: item.id,
        title: item.title,
        price: item.price,
        quantity: 1,
      });
    }
  }

  return Array.from(grouped.values());
}

/**
 * Convert a domain ShippingDetails to DTO shape (already compatible for now).
 */
export function shippingDetailsToDTO(
  shipping: ShippingDetails
): CheckoutRequestDTO['shipping'] {
  return {
    fullName: shipping.fullName,
    addressLine1: shipping.addressLine1,
    city: shipping.city,
    state: shipping.state,
    zip: shipping.zip,
  };
}

/**
 * Convert a domain PaymentDetails to DTO shape (already compatible for now).
 */
export function paymentDetailsToDTO(
  payment: PaymentDetails
): CheckoutRequestDTO['payment'] {
  return {
    method: payment.method,
    cardLast4: payment.cardLast4,
  };
}
