import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AdminService } from './admin.service';
import { Product } from '../models/product';

const mockProduct: Product = {
  id: 1,
  title: 'Test Product',
  category: 'Electronics',
  description: 'A test product description',
  price: 29.99,
  imageUrl: 'https://example.com/image.jpg',
  inStock: true,
  stockCount: 10,
  rating: 4.5,
  ratingCount: 100
};

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;
  const apiUrl = 'http://192.168.1.5:3000/products';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AdminService]
    });
    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getProducts() should GET all products', () => {
    service.getProducts().subscribe(products => {
      expect(products.length).toBe(1);
      expect(products[0].title).toBe('Test Product');
    });
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('GET');
    req.flush([mockProduct]);
  });

  it('createProduct() should POST and return created product', () => {
    const { id, ...newProduct } = mockProduct;
    service.createProduct(newProduct).subscribe(product => {
      expect(product.id).toBe(1);
      expect(product.title).toBe('Test Product');
    });
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(newProduct);
    req.flush(mockProduct);
  });

  it('updateProduct() should PUT and return updated product', () => {
    const updates = { title: 'Updated Title', price: 39.99 };
    service.updateProduct(1, updates).subscribe(product => {
      expect(product.title).toBe('Updated Title');
    });
    const req = httpMock.expectOne(`${apiUrl}/1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(updates);
    req.flush({ ...mockProduct, ...updates });
  });

  it('deleteProduct() should send DELETE request', () => {
    service.deleteProduct(1).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
