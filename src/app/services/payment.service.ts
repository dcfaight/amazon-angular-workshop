import { Injectable } from '@angular/core';
import { PaymentDetails } from '../models/checkout';

export interface PaymentReceipt {
  transactionId: string;
  processedAtIso: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  async processPayment(payment: PaymentDetails, amount: number): Promise<PaymentReceipt> {
    await new Promise<void>((resolve) => setTimeout(resolve, 150));

    if (payment.method === 'card' && payment.cardLast4?.trim() === '0000') {
      const decline = new Error('Payment was declined by the issuer. Please use a different card.');
      (decline as any).reason = 'PAYMENT_DECLINED';
      throw decline;
    }

    if (amount <= 0) {
      const invalidAmount = new Error('Payment amount must be greater than zero.');
      (invalidAmount as any).reason = 'PAYMENT_DECLINED';
      throw invalidAmount;
    }

    return {
      transactionId: `PAY-${Date.now()}`,
      processedAtIso: new Date().toISOString(),
    };
  }
}