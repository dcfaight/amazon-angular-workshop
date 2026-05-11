import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ToastService {
  message$ = new BehaviorSubject<string | null>(null);

  show(message: string, duration = 2200): void {
    this.message$.next(message);
    setTimeout(() => this.message$.next(null), duration);
  }
}
