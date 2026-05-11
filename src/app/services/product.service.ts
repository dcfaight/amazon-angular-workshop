// src/app/product.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Product } from '../models/product';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private simulateFailures = environment.features.simulateBackendFailuresDefault;
  private apiUrl = 'http://192.168.1.5:3000/products';

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {}

  // Fallback in-memory products
  private inMemoryProducts: Product[] = [
  // Gadgets & Electronics
  {
    id: 1,
    title: 'Kindle Paperwhite',
    category: 'Electronics',
    description: 'Read with comfort and a glare-free screen.',
    price: 139.99,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/61UW261OufL._AC_SX425_.jpg',
    inStock: true,
    rating: 4.7,
    ratingCount: 19814,
    review: "The best e-reader I’ve ever owned!"
  },
  {
    id: 2,
    title: 'Echo Dot (5th Gen)',
    category: 'Electronics',
    description: 'Smart speaker with Alexa for any room.',
    price: 49.99,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/714Rq4k05UL._AC_SX425_.jpg',
    inStock: false,
    rating: 4.6,
    ratingCount: 25020,
    review: "Great for music and smart home commands."
  },
  {
    id: 3,
    title: 'Fire TV Stick 4K Max',
    category: 'Electronics',
    description: 'Streaming device for immersive 4K entertainment.',
    price: 39.99,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/51CgKGfMelL._AC_SX425_.jpg',
    inStock: true,
    rating: 4.8,
    ratingCount: 18233,
    review: "Fast, reliable, and easy to navigate."
  },
  {
    id: 4,
    title: 'Apple AirPods Pro (2nd Gen)',
    category: 'Electronics',
    description: 'Active noise cancellation, sweat and water resistant.',
    price: 199.99,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/61SUj2aKoEL._AC_SL1500_.jpg',
    inStock: true,
    rating: 4.9,
    ratingCount: 32155,
    review: "Excellent sound quality and comfort."
  },
  {
    id: 5,
    title: 'Logitech Wireless Mouse M510',
    category: 'Electronics',
    description: 'Contoured shape with soft rubber grips.',
    price: 24.99,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/61LtuGzXeaL._AC_SX450_.jpg',
    inStock: true,
    rating: 4.5,
    ratingCount: 15783,
    review: "Reliable and ergonomic for daily use."
  },
  // Books
  {
    id: 6,
    title: 'Atomic Habits',
    category: 'Books',
    description: 'An Easy & Proven Way to Build Good Habits & Break Bad Ones by James Clear',
    price: 11.98,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/91bYsX41DVL.jpg',
    inStock: true,
    rating: 4.8,
    ratingCount: 102722,
    review: "Life-changing advice, very well-written."
  },
  {
    id: 7,
    title: 'The Midnight Library',
    category: 'Books',
    description: 'A novel by Matt Haig about choices, regrets, and second chances.',
    price: 13.49,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/81jE%2Bb1C4xL.jpg',
    inStock: false,
    rating: 4.4,
    ratingCount: 31693,
    review: "Beautifully written and inspiring."
  },
  {
    id: 8,
    title: 'Project Hail Mary',
    category: 'Books',
    description: 'A novel by Andy Weir, mixing science and suspense.',
    price: 16.19,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/81VK8WQ2QwS.jpg',
    inStock: true,
    rating: 4.7,
    ratingCount: 19570,
    review: "Could not put it down! A sci-fi masterpiece."
  },
  {
    id: 9,
    title: 'Educated',
    category: 'Books',
    description: 'A Memoir by Tara Westover.',
    price: 14.99,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/81WojUxbbFL.jpg',
    inStock: true,
    rating: 4.7,
    ratingCount: 89421,
    review: "A powerful and moving memoir."
  },
  {
    id: 10,
    title: 'The Subtle Art of Not Giving a F*ck',
    category: 'Books',
    description: 'A counterintuitive approach to living a good life.',
    price: 16.99,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/71QKQ9mwV7L.jpg',
    inStock: true,
    rating: 4.5,
    ratingCount: 68141,
    review: "Bold, honest, and refreshing."
  },
  // Sports Gear
  {
    id: 11,
    title: 'Wilson Evolution Game Basketball',
    category: 'Sports',
    description: 'Indoor basketball with superior grip and feel.',
    price: 69.99,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/91L5wMra6bL._AC_SX425_.jpg',
    inStock: true,
    rating: 4.8,
    ratingCount: 5114,
    review: "The best ball for high school players."
  },
  {
    id: 12,
    title: 'Fitbit Charge 5',
    category: 'Sports',
    description: 'Health & fitness tracker with built-in GPS.',
    price: 119.95,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/61Qe0euJJZL._AC_SX466_.jpg',
    inStock: true,
    rating: 4.3,
    ratingCount: 6330,
    review: "Tracks everything I need for daily wellness."
  },
  {
    id: 13,
    title: 'Speedo Unisex-Adult Swim Goggles',
    category: 'Sports',
    description: 'Mirrored lens, adjustable nose bridge, UV protection.',
    price: 15.99,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/81p5yRYWgCL._AC_SX425_.jpg',
    inStock: false,
    rating: 4.4,
    ratingCount: 2331,
    review: "No leaks and very comfortable."
  },
  {
    id: 14,
    title: 'Under Armour Men\'s Tech 2.0 T-Shirt',
    category: 'Sports',
    description: 'Quick-drying, ultra-soft, moisture-wicking.',
    price: 16.49,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/81zYMIp79uL._AC_SY879_.jpg',
    inStock: true,
    rating: 4.7,
    ratingCount: 22242,
    review: "My go-to gym shirt."
  },
  {
    id: 15,
    title: 'Spalding NBA Street Outdoor Basketball',
    category: 'Sports',
    description: 'Durable rubber cover for outdoor courts.',
    price: 21.99,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/81BISo9dG0L._AC_SX425_.jpg',
    inStock: true,
    rating: 4.6,
    ratingCount: 11563,
    review: "Tough and grippy for street games."
  },
  // Home & More
  {
    id: 16,
    title: 'Brita Water Filter Pitcher',
    category: 'Home',
    description: '6-cup capacity, reduces chlorine taste and odor.',
    price: 22.99,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/71CxlvZekJL._AC_SX466_.jpg',
    inStock: true,
    rating: 4.5,
    ratingCount: 16501,
    review: "Improves tap water taste instantly."
  },
  {
    id: 17,
    title: 'Instant Pot Duo 7-in-1 Electric Pressure Cooker',
    category: 'Home',
    description: '7 appliances in 1, cooks meals up to 70% faster.',
    price: 79.00,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/81A2V6NIIvL._AC_SX679_.jpg',
    inStock: true,
    rating: 4.8,
    ratingCount: 36513,
    review: "Makes cooking dinner fast and easy."
  },
  {
    id: 18,
    title: 'Furbo Dog Camera',
    category: 'Home',
    description: 'HD WiFi pet camera with 2-way audio and treat toss.',
    price: 199.00,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/61EsS5UoDhL._AC_SX425_.jpg',
    inStock: false,
    rating: 4.5,
    ratingCount: 21814,
    review: "Fun way to interact with my dog while away."
  },
  {
    id: 19,
    title: 'Cuisinart Knife Set',
    category: 'Home',
    description: '15-piece stainless steel knives with block.',
    price: 59.95,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/81IuxYhFiSL._AC_SX466_.jpg',
    inStock: true,
    rating: 4.7,
    ratingCount: 18420,
    review: "Sharp and affordable for any kitchen."
  },
  {
    id: 20,
    title: 'Anker Portable Charger PowerCore',
    category: 'Electronics',
    description: 'Power bank 10000mAh with high-speed charging.',
    price: 25.99,
    imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/51smZdVynAL._AC_SX522_.jpg',
    inStock: true,
    rating: 4.8,
    ratingCount: 48153,
    review: "Holds a charge forever and is very portable."
  },
];

  setSimulateFailures(enabled: boolean): void {
    this.simulateFailures = enabled;
  }

  getProducts(): Product[] {
    // Synchronous fallback - returns in-memory products
    return this.filterByTenant(this.inMemoryProducts);
  }

  getProducts$(): Observable<Product[]> {
    // Try API first, fall back to in-memory on any error
    return this.http.get<Product[]>(this.apiUrl).pipe(
      map((products) => {
        if (this.simulateFailures && Math.random() < 0.2) {
          throw new Error('Failed to fetch products - simulated backend outage.');
        }
        return this.filterByTenant(products);
      }),
      catchError(() => {
        // Use in-memory fallback on any error
        return of(this.filterByTenant(this.inMemoryProducts));
      })
    );
  }

  getById(id: number): Product | null {
    // Synchronous fallback - searches in-memory products
    return this.inMemoryProducts.find((product) => product.id === id) || null;
  }

  getById$(id: number): Observable<Product | null> {
    // Keep detail view source-of-truth from the API response.
    return this.http.get<Product>(`${this.apiUrl}/${id}`).pipe(
      map((product) => product || null),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of(null);
        }

        return throwError(() => error);
      })
    );
  }

  private filterByTenant(products: Product[]): Product[] {
    const currentTenantId = this.authService.currentUserValue?.tenantId ?? 'tenant-a';
    return products.filter((product) => !product.tenantId || product.tenantId === currentTenantId);
  }

  // Fallback in-memory products
}