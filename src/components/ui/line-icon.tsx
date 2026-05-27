/**
 * Official LINE brand mark (white speech bubble + "LINE" wordmark on the
 * brand-green background). LINE's brand guidelines require the wordmark
 * NOT be detached from the bubble, so we render the full lockup as a
 * single SVG to be safe — flat fills, no gradients, no shadows. Used on
 * the web sign-in form per the CET 2026-05-26 OAuth-button law.
 */
export function LineIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 36 36"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="36" height="36" rx="8" fill="#06C755" />
      <path
        d="M30 16.2c0-5.4-5.4-9.8-12-9.8S6 10.8 6 16.2c0 4.8 4.3 8.8 10 9.6.4.1.9.3 1.1.6.1.3.1.7.1 1l-.2 1.1c-.1.3-.3 1.3 1.1.7 1.4-.6 7.5-4.4 10.2-7.6 1.8-2 2.7-4 2.7-5.4z"
        fill="#fff"
      />
      <path
        d="M14.6 13.6h-.8c-.1 0-.2.1-.2.2v5.2c0 .1.1.2.2.2h.8c.1 0 .2-.1.2-.2v-5.2c0-.1-.1-.2-.2-.2zm5.7 0h-.8c-.1 0-.2.1-.2.2v3.1l-2.4-3.2v-.1h-1c-.1 0-.2.1-.2.2v5.2c0 .1.1.2.2.2h.8c.1 0 .2-.1.2-.2v-3.1l2.4 3.2c0 .1.1.1.2.1h.8c.1 0 .2-.1.2-.2v-5.2c0-.1-.1-.2-.2-.2zm-7.6 4.4h-2.3v-4.2c0-.1-.1-.2-.2-.2h-.8c-.1 0-.2.1-.2.2v5.2c0 .1.1.2.2.2h3.3c.1 0 .2-.1.2-.2v-.8c0-.1-.1-.2-.2-.2zm12 0h-2.3v-1h2.3c.1 0 .2-.1.2-.2v-.8c0-.1-.1-.2-.2-.2h-2.3v-1h2.3c.1 0 .2-.1.2-.2v-.8c0-.1-.1-.2-.2-.2h-3.3c-.1 0-.2.1-.2.2v5.2c0 .1.1.2.2.2h3.3c.1 0 .2-.1.2-.2v-.8c0-.1-.1-.2-.2-.2z"
        fill="#06C755"
      />
    </svg>
  );
}
