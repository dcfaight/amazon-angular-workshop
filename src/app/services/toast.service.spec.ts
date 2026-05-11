import { TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have a message$ observable initialized to null', (done) => {
    service.message$.subscribe((message) => {
      expect(message).toBeNull();
      done();
    });
  });

  it('should show a message', (done) => {
    service.show('Test message');
    service.message$.subscribe((message) => {
      expect(message).toBe('Test message');
      done();
    });
  });

  it('should clear message after default duration (2200ms)', fakeAsync(() => {
    let emittedMessages: (string | null)[] = [];
    service.message$.subscribe((message) => {
      emittedMessages.push(message);
    });

    service.show('Test message');
    tick(2200);

    expect(emittedMessages[emittedMessages.length - 1]).toBeNull();
  }));

  it('should clear message after custom duration', fakeAsync(() => {
    let emittedMessages: (string | null)[] = [];
    service.message$.subscribe((message) => {
      emittedMessages.push(message);
    });

    service.show('Test message', 1000);
    tick(1000);

    expect(emittedMessages[emittedMessages.length - 1]).toBeNull();
  }));

  it('should replace previous message when show is called again', fakeAsync(() => {
    let emittedMessages: (string | null)[] = [];
    service.message$.subscribe((message) => {
      emittedMessages.push(message);
    });

    service.show('First message');
    service.show('Second message');

    expect(emittedMessages[emittedMessages.length - 1]).toBe('Second message');
    
    tick(3000);
    flush();
  }));

  it('should handle empty message string', fakeAsync(() => {
    let emittedMessages: (string | null)[] = [];
    service.message$.subscribe((message) => {
      emittedMessages.push(message);
    });

    service.show('');
    expect(emittedMessages[emittedMessages.length - 1]).toBe('');

    tick(2200);
    expect(emittedMessages[emittedMessages.length - 1]).toBeNull();
  }));

  it('should handle very long messages', fakeAsync(() => {
    const longMessage = 'a'.repeat(1000);
    let emittedMessage: string | null | undefined = undefined;
    service.message$.subscribe((message) => {
      if (message) {
        emittedMessage = message;
      }
    });

    service.show(longMessage);
    expect(emittedMessage).toBe(longMessage as any);

    tick(2200);
    expect(emittedMessage).toBe(longMessage as any);
  }));

  it('should clear timeout when new message is shown', fakeAsync(() => {
    let emittedMessages: (string | null)[] = [];
    service.message$.subscribe((message) => {
      emittedMessages.push(message);
    });

    service.show('First message');
    tick(1000);
    service.show('Second message');
    tick(2200);

    expect(emittedMessages[emittedMessages.length - 1]).toBeNull();
  }));
});
