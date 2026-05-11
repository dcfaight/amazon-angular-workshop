// src/app/models/product.ts
export interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  inStock: boolean;
  rating?: number;
  ratingCount?: number;
  review?: string;
  category?: string;
  tenantId?: string;
  stockCount?: number;
}

export {};