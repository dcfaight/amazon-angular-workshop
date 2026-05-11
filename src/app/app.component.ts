import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { ToastService } from './services/toast.service';
import { AuthService } from './services/auth.service';
import { AppStateService } from './services/app-state.service';
import { User } from './models/user';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'amazon-angular-workshop';
  toast$ = this.toastService.message$;
  currentUser$ = this.authService.currentUser$;
  cartCount$ = this.appState.cartCount$;
  cartItems$ = this.appState.cartItems$;
  cartOpen$ = this.appState.cartOpen$;
  theme$ = this.appState.theme$;

  constructor(
    private toastService: ToastService,
    private authService: AuthService,
    private appState: AppStateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.appState.initializeFeatureFlagsFromStorage();
  }

  toggleCart(): void {
    this.appState.toggleCart();
  }

  toggleTheme(): void {
    this.appState.toggleTheme();
  }

  getPrimaryRole(user: User): string {
    return user.roles?.[0] ?? 'customer';
  }

  getRoleBadgeClass(user: User): string {
    return `role-badge ${this.getPrimaryRole(user).toLowerCase()}`;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.appState.cartOpenValue) {
      this.appState.setCartOpen(false);
    }
  }

  async signOut(): Promise<void> {
    await this.authService.signOut();
    this.appState.clearCart();
    this.appState.setCartOpen(false);
    this.toastService.show('Signed out.');
    await this.router.navigate(['/sign-in']);
  }
}
