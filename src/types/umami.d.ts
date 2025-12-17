export {};

declare global {
  interface Window {
    umami?: {
      track: (eventName: string | ((props: any) => any), data?: Record<string, any>) => void;
    };
  }
}
