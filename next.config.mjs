/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep worker packages out of the webpack bundle — otherwise
  // tesseract.js looks for workers under .next/worker-script and crashes.
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "bcryptjs",
      "tesseract.js",
      "tesseract.js-core",
    ],
  },
};

export default nextConfig;
