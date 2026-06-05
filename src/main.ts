import 'hammerjs';

import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { EditorModule } from 'app/modules/editor/editor.module';
import { environment } from 'environments/environment';

// Initialize Firebase Analytics (GA4). isSupported() guards against
// environments where analytics can't run (e.g. cookies disabled).
const firebaseApp = initializeApp(environment.firebaseConfig);
isSupported()
  .then(supported => {
    if (supported) {
      getAnalytics(firebaseApp);
    }
  })
  .catch(() => {
    // Analytics is non-critical; ignore initialization failures.
  });

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(EditorModule);
