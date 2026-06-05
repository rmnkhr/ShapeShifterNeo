import 'hammerjs';

import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { initializeApp } from 'firebase/app';
import { Analytics, getAnalytics, isSupported, logEvent } from 'firebase/analytics';
import { EditorModule } from 'app/modules/editor/editor.module';
import { environment } from 'environments/environment';

// Initialize Firebase Analytics (GA4). isSupported() guards against
// environments where analytics can't run (e.g. cookies disabled).
const firebaseApp = initializeApp(environment.firebaseConfig);
let analytics: Analytics | undefined;
isSupported()
  .then(supported => {
    if (supported) {
      analytics = getAnalytics(firebaseApp);
    }
  })
  .catch(() => {
    // Analytics is non-critical; ignore initialization failures.
  });

// Back-compat shim for the legacy Universal Analytics global. Components still
// call `ga('send', 'event', category, action, label)`; the old analytics.js
// snippet that defined `window.ga` was removed in the Firebase migration, so
// without this every such call throws ReferenceError and aborts its handler
// (e.g. File → Demo). Forward events to Firebase Analytics; no-op otherwise.
(window as any).ga = (...args: unknown[]) => {
  const [command, hitType, eventCategory, eventAction, eventLabel] = args;
  if (analytics && command === 'send' && hitType === 'event') {
    logEvent(analytics, 'legacy_event', {
      event_category: eventCategory,
      event_action: eventAction,
      ...(eventLabel === undefined ? {} : { event_label: eventLabel }),
    });
  }
};

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(EditorModule);
