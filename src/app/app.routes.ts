import { Routes } from '@angular/router';
import { ProductListComponent } from './product-list/product-list.component';
import { ProductDetailComponent } from './product-detail/product-detail.component';
import { CartComponent } from './cart/cart.component';
import { CheckoutComponent } from './checkout/checkout.component';
import { SignInComponent } from './sign-in/sign-in.component';
import { AdminComponent } from './admin/admin.component';
import { AdminIncidentsComponent } from './admin-incidents/admin-incidents.component';
import { OrderHistoryComponent } from './order-history/order-history.component';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: 'sign-in', component: SignInComponent },
  { path: '', component: ProductListComponent, canActivate: [authGuard] },
  { path: 'product/:id', component: ProductDetailComponent, canActivate: [authGuard] },
  { path: 'cart', component: CartComponent, canActivate: [authGuard] },
  { path: 'checkout', component: CheckoutComponent, canActivate: [authGuard] },
  { path: 'orders', component: OrderHistoryComponent, canActivate: [authGuard] },
  { path: 'admin', component: AdminComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/incidents', component: AdminIncidentsComponent, canActivate: [authGuard, adminGuard] },
  { path: '**', redirectTo: '' }
];