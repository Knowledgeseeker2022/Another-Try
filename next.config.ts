import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.microsoft.com" },
      { protocol: "https", hostname: "**.microsoftonline.com" },
    ],
  },
};

export default nextConfig;
