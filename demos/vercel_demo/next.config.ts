import type { NextConfig } from 'next';

const config: NextConfig = {
  async headers() {
    return [{
      source: '/api/:path*',
      headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
    }];
  },
};

export default config;
