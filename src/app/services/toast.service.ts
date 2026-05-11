import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ToastService {
  message$ = new BehaviorSubject<string | null>(null);
  private dismissTimeoutId: ReturnType<typeof setTimeout> | null = null;

  show(message: string, duration = 2200): void {
    if (this.dismissTimeoutId !== null) {
      clearTimeout(this.dismissTimeoutId);
    }

    this.message$.next(message);
    this.dismissTimeoutId = setTimeout(() => {
      this.message$.next(null);
      this.dismissTimeoutId = null;
    }, duration);
  }
}
