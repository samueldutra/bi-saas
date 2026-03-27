import type { NextConfig } from "next";

/**
 * Security headers configuration
 * @see https://nextjs.org/docs/advanced-features/security-headers
 */
const securityHeaders = [
  {
    // Prevents clickjacking attacks by disallowing the site to be embedded in iframes
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    // Prevents MIME type sniffing attacks
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    // Controls referrer information sent with requests
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    // Disables browser features not needed by the app
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()'
  },
  {
    // Enables XSS filtering in browsers that support it
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  // HSTS - Forces HTTPS connections (add in production with valid SSL)
  // { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  // Apply security headers to all routes
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },

  // Disable x-powered-by header to hide Next.js version
  poweredByHeader: false,
};

export default nextConfig;
