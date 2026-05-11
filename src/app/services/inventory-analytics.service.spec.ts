import { TestBed } from '@angular/core/testing';
import { Product } from '../models/product';
import { InventoryAnalyticsService } from './inventory-analytics.service';

describe('InventoryAnalyticsService', () => {
  let service: InventoryAnalyticsService;

  const product = (id: number, stockCount: number, price: number, inStock = true): Product => ({
    id,
    title: `Product ${id}`,
    description: 'desc',
    imageUrl: 'http://image.test',
    inStock,
    stockCount,
    price,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InventoryAnalyticsService);
  });

  it('should compute inventory totals and risk breakdown', () => {
    const analytics = service.analyze([
      product(1, 10, 20),
      product(2, 2, 15),
      product(3, 1, 5),
      product(4, 0, 30, false),
    ]);

    expect(analytics.totalUnitsOnHand).toBe(13);
    expect(analytics.outOfStockProducts).toBe(1);
    expect(analytics.lowStockRate).toBe(50);
    expect(analytics.atRiskProducts.map((item) => item.id)).toEqual([3, 2]);
  });

  it('should return highest inventory value products in descending order', () => {
    const analytics = service.analyze([
      product(1, 1, 10),
      product(2, 10, 9),
      product(3, 2, 50),
      product(4, 3, 15),
    ]);

    expect(analytics.topInventoryValueProducts.map((item) => item.id)).toEqual([3, 2, 4]);
    expect(analytics.topInventoryValueProducts[0].inventoryValue).toBe(100);
  });

  it('should handle empty product lists', () => {
    const analytics = service.analyze([]);

    expect(analytics.totalUnitsOnHand).toBe(0);
    expect(analytics.outOfStockProducts).toBe(0);
    expect(analytics.lowStockRate).toBe(0);
    expect(analytics.atRiskProducts).toEqual([]);
    expect(analytics.topInventoryValueProducts).toEqual([]);
  });
});