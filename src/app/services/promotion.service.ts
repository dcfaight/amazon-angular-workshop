import { Injectable } from '@angular/core';

type PromotionKind = 'percentage' | 'fixed';

interface PromotionRule {
  code: string;
  kind: PromotionKind;
  value: number;
  minimumSubtotal?: number;
}

export interface AppliedPromotion {
  code: string;
  discountAmount: number;
  description: string;
}

export interface PromotionEvaluation {
  valid: boolean;
  message: string;
  promotion?: AppliedPromotion;
}

@Injectable({ providedIn: 'root' })
export class PromotionService {
  private readonly promotions: PromotionRule[] = [
    { code: 'SAVE10', kind: 'percentage', value: 10 },
    { code: 'SAVE20', kind: 'percentage', value: 20, minimumSubtotal: 100 },
    { code: 'LESS15', kind: 'fixed', value: 15, minimumSubtotal: 75 },
  ];

  evaluatePromotion(codeInput: string, subtotal: number): PromotionEvaluation {
    const normalizedCode = codeInput.trim().toUpperCase();

    if (!normalizedCode) {
      return { valid: false, message: 'Enter a promo code.' };
    }

    const rule = this.promotions.find((promotion) => promotion.code === normalizedCode);
    if (!rule) {
      return { valid: false, message: 'Promo code is invalid.' };
    }

    if (rule.minimumSubtotal && subtotal < rule.minimumSubtotal) {
      return {
        valid: false,
        message: `${rule.code} requires a subtotal of $${rule.minimumSubtotal.toFixed(2)} or more.`,
      };
    }

    const rawDiscount =
      rule.kind === 'percentage' ? subtotal * (rule.value / 100) : rule.value;
    const discountAmount = Number(Math.min(rawDiscount, subtotal).toFixed(2));
    const description =
      rule.kind === 'percentage' ? `${rule.value}% off` : `$${rule.value.toFixed(2)} off`;

    return {
      valid: true,
      message: `${rule.code} applied successfully.`,
      promotion: {
        code: rule.code,
        discountAmount,
        description,
      },
    };
  }
}