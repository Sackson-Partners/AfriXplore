import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';

export const reactPlugin = new ReactPlugin();

export const appInsights = new ApplicationInsights({
  config: {
    connectionString: process.env.NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING,
    extensions: [reactPlugin],
    enableAutoRouteTracking: true,
    autoTrackPageVisitTime: true,
    enableCorsCorrelation: true,
    enableRequestHeaderTracking: true,
    enableResponseHeaderTracking: true,
    disableFetchTracking: false,
  },
});

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING) {
  appInsights.loadAppInsights();
}

export const trackUserJourney = (step: string, properties?: Record<string, string>): void => {
  if (typeof window === 'undefined') return;
  appInsights.trackEvent({ name: `journey.${step}`, properties });
};
