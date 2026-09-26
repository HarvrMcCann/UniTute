import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let Node load officeparser itself: bundled, it resolves to its browser build and breaks.
  serverExternalPackages: ["officeparser"],
};

export default nextConfig;
