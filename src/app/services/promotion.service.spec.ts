import { TestBed } from '@angular/core/testing';
import { PromotionService } from './promotion.service';

describe('PromotionService', () => {
  let service: PromotionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PromotionService);
  });

  it('should reject empty promo codes', () => {
    const result = service.evaluatePromotion('   ', 100);

    expect(result.valid).toBeFalse();
    expect(result.message).toBe('Enter a promo code.');
  });

  it('should apply SAVE10 as a percentage discount', () => {
    const result = service.evaluatePromotion('save10', 120);

    expect(result.valid).toBeTrue();
    expect(result.promotion?.code).toBe('SAVE10');
    expect(result.promotion?.discountAmount).toBe(12);
  });

  it('should enforce minimum subtotal for SAVE20', () => {
    const result = service.evaluatePromotion('SAVE20', 80);

    expect(result.valid).toBeFalse();
    expect(result.message).toContain('requires a subtotal');
  });

  it('should apply fixed discount rules and cap at subtotal', () => {
    const valid = service.evaluatePromotion('LESS15', 100);
    const capped = service.evaluatePromotion('LESS15', 10);

    expect(valid.valid).toBeTrue();
    expect(valid.promotion?.discountAmount).toBe(15);
    expect(capped.valid).toBeFalse();
  });

  it('should reject unknown promo codes', () => {
    const result = service.evaluatePromotion('NOPE', 200);

    expect(result.valid).toBeFalse();
    expect(result.message).toBe('Promo code is invalid.');
  });
});