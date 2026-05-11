import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.scss',
})
export class SignInComponent {
  username = '';
  password = '';
  tenantId = 'tenant-a';
  isSubmitting = false;
  errorMessage = '';
  readonly useAmplifyAuth = environment.features.useAmplifyAuth;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService
  ) {}

  async submit(): Promise<void> {
    this.errorMessage = '';
    this.isSubmitting = true;

    try {
      await this.authService.signIn({
        username: this.username,
        password: this.password,
        tenantId: this.tenantId,
      });

      this.toastService.show('Signed in successfully.');
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
      await this.router.navigateByUrl(returnUrl);
    } catch (error) {
      this.errorMessage = (error as Error).message;
    } finally {
      this.isSubmitting = false;
    }
  }

  async signInAsDemoUser(tenantId: 'tenant-a' | 'tenant-b'): Promise<void> {
    this.username = tenantId === 'tenant-a' ? 'alex.demo' : 'sam.demo';
    this.password = 'password123';
    this.tenantId = tenantId;
    await this.submit();
  }
}
