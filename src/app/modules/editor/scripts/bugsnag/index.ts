import Bugsnag from '@bugsnag/js';
import { BugsnagErrorHandler, plugin as BugsnagPluginAngular } from '@bugsnag/plugin-angular';
import { environment } from 'environments/environment';
import { version } from 'environments/version';

Bugsnag.start({
  apiKey: 'd662c2c8a7e13ac94f67e81e26bf3a4e',
  appVersion: version,
  releaseStage: environment.production ? 'production' : 'development',
  enabledReleaseStages: ['production'],
  plugins: [BugsnagPluginAngular],
});

export const bugsnagClient = Bugsnag;

export function errorHandlerFactory() {
  return new BugsnagErrorHandler();
}
