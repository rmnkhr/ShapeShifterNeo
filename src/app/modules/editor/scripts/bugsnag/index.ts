import Bugsnag from '@bugsnag/js';
import { BugsnagErrorHandler } from '@bugsnag/plugin-angular';
import { environment } from 'environments/environment';
import { version } from 'environments/version';

// We intentionally skip the plugin (`plugin` from @bugsnag/plugin-angular@8.9):
// it rewrites client._notify with a wrapper that calls the captured method as
// a free function, losing `this`. BugsnagErrorHandler on its own provides the
// Angular ErrorHandler bridge we actually need.
const client = Bugsnag.start({
  apiKey: 'd662c2c8a7e13ac94f67e81e26bf3a4e',
  appVersion: version,
  releaseStage: environment.production ? 'production' : 'development',
  enabledReleaseStages: ['production'],
});

export const bugsnagClient = client;

export function errorHandlerFactory() {
  return new BugsnagErrorHandler(client);
}
