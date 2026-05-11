import { bootstrapApplication } from '@angular/platform-browser';
import { Amplify } from 'aws-amplify';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import awsExports from './aws-exports';
import { environment } from './environments/environment';

if (environment.features.useAmplifyAuth) {
  Amplify.configure(awsExports as Record<string, unknown>);
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));