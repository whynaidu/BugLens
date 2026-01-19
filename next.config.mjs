/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile react-konva and konva
  transpilePackages: ['react-konva', 'konva'],

  // Empty turbopack config to silence warnings
  turbopack: {},
};

export default nextConfig;
