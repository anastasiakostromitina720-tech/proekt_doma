/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace symlink + `exports` — Next must transpile the linked package
  // so webpack resolves `@app/contracts` reliably (see monorepo docs).
  transpilePackages: ['@app/contracts'],
  experimental: {
    typedRoutes: false,
  },
  webpack: (config, { webpack }) => {
    // Konva's Node entry optionally requires `canvas`; Next still traces it
    // during bundling. Not used in the browser — ignore to unblock `next build`.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^canvas$/,
      }),
    );
    return config;
  },
};

export default nextConfig;
