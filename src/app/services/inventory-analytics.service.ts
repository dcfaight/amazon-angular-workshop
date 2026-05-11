import { Injectable } from '@angular/core';
import { Product } from '../models/product';

export interface InventoryRiskProduct {
  id: number;
  title: string;
  stockCount: number;
}

export interface InventoryValueProduct {
  id: number;
  title: string;
  stockCount: number;
  inventoryValue: number;
}

export interface InventoryAnalytics {
  totalUnitsOnHand: number;
  outOfStockProducts: number;
  lowStockRate: number;
  atRiskProducts: InventoryRiskProduct[];
  topInventoryValueProducts: InventoryValueProduct[];
}

@Injectable({ providedIn: 'root' })
export class InventoryAnalyticsService {
  private readonly lowStockThreshold = 2;

  analyze(products: Product[]): InventoryAnalytics {
    const normalized = products.map((product) => {
      const stockCount = this.getStockCount(product);
      return {
        ...product,
        stockCount,
        inventoryValue: Number((product.price * stockCount).toFixed(2)),
      };
    });

    const totalUnitsOnHand = normalized.reduce((sum, product) => sum + product.stockCount, 0);
    const outOfStockProducts = normalized.filter((product) => !product.inStock || product.stockCount === 0).length;
    const atRiskProducts = normalized
      .filter((product) => product.inStock && product.stockCount > 0 && product.stockCount <= this.lowStockThreshold)
      .sort((left, right) => left.stockCount - right.stockCount)
      .slice(0, 5)
      .map((product) => ({
        id: product.id,
        title: product.title,
        stockCount: product.stockCount,
      }));

    const topInventoryValueProducts = normalized
      .filter((product) => product.stockCount > 0)
      .sort((left, right) => right.inventoryValue - left.inventoryValue)
      .slice(0, 3)
      .map((product) => ({
        id: product.id,
        title: product.title,
        stockCount: product.stockCount,
        inventoryValue: product.inventoryValue,
      }));

    const lowStockRate = normalized.length
      ? Number(((atRiskProducts.length / normalized.length) * 100).toFixed(1))
      : 0;

    return {
      totalUnitsOnHand,
      outOfStockProducts,
      lowStockRate,
      atRiskProducts,
      topInventoryValueProducts,
    };
  }

  private getStockCount(product: Product): number {
    return Math.max(0, Math.floor(product.stockCount ?? 0));
  }
}