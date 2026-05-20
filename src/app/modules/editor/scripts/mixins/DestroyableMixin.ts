import { OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

export interface IDestroyable extends OnDestroy {
  registerSubscription(sub: Subscription): void;
}

class EmptyBase {}

export function DestroyableMixin<TBase extends Constructor = typeof EmptyBase>(
  Base: TBase = (EmptyBase as unknown) as TBase,
): Constructor<IDestroyable> & TBase {
  return class Destroyable extends Base implements OnDestroy {
    private readonly subscriptions: Subscription[] = [];

    registerSubscription(sub: Subscription) {
      this.subscriptions.push(sub);
    }

    ngOnDestroy() {
      this.subscriptions.forEach(x => x.unsubscribe());
    }
  } as Constructor<IDestroyable> & TBase;
}
