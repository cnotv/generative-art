export {};

declare global {
  interface Window {
    umami?: {
      track: (eventName: string | ((props: Record<string, unknown>) => Record<string, unknown>), data?: Record<string, unknown>) => void;
    };
  }
}
