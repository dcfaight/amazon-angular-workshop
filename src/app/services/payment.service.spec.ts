import { TestBed } from '@angular/core/testing';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PaymentService);
  });

  it('should process card payments successfully', async () => {
    const receipt = await service.processPayment({ method: 'card', cardLast4: '4242' }, 99.5);

    expect(receipt.transactionId).toMatch(/^PAY-\d+$/);
    expect(receipt.processedAtIso).toMatch(/Z$/);
  });

  it('should decline specific card test value', async () => {
    await expectAsync(
      service.processPayment({ method: 'card', cardLast4: '0000' }, 40)
    ).toBeRejectedWith(
      jasmine.objectContaining({
        message: 'Payment was declined by the issuer. Please use a different card.',
        reason: 'PAYMENT_DECLINED',
      })
    );
  });

  it('should reject zero or negative amounts', async () => {
    await expectAsync(
      service.processPayment({ method: 'paypal' }, 0)
    ).toBeRejectedWith(
      jasmine.objectContaining({
        message: 'Payment amount must be greater than zero.',
        reason: 'PAYMENT_DECLINED',
      })
    );
  });
});