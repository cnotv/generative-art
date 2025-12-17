interface UmamiConfig {
  websiteId: string;
  srcUrl?: string; // Defaults to Umami Cloud
  domains?: string; // Optional: comma-separated list of allowed domains
}

const DEFAULT_SCRIPT_URL = 'https://cloud.umami.is/script.js';

export function useUmami() {
  const loadUmami = (config: UmamiConfig) => {
    // Prevent loading the script twice
    if (document.getElementById('umami-script')) {
      return;
    }

    const script = document.createElement('script');
    script.id = 'umami-script';
    script.async = true;
    script.defer = true;
    script.src = config.srcUrl || DEFAULT_SCRIPT_URL;
    
    // Required Attribute
    script.setAttribute('data-website-id', config.websiteId);

    // Optional Attributes
    if (config.domains) {
      script.setAttribute('data-domains', config.domains);
    }

    document.head.appendChild(script);
  };

  /**
   * Track a custom event
   * @param eventName - The name of the event (e.g., "signup-button")
   * @param eventData - Optional object with extra details (e.g., { plan: "pro" })
   */
  const trackEvent = (eventName: string, eventData?: Record<string, any>) => {
    if (window.umami) {
      window.umami.track(eventName, eventData);
    } else {
      console.warn('[Umami] Tracking script not loaded yet.');
    }
  };

  /**
   * Manually track a page view (Usually not needed as Umami tracks automatically)
   * Use this only if you have disabled auto-tracking
   */
  const trackPageView = (url?: string) => {
    if (window.umami) {
      // Umami handles page views by sending properties. 
      // If url is undefined, it uses the current window location.
      window.umami.track((props: any) => ({ ...props, url: url || props.url }));
    }
  };

  return {
    loadUmami,
    trackEvent,
    trackPageView,
  };
}
