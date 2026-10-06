import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The events API reads content/issues/*.json at request time.
  outputFileTracingIncludes: {
    "/api/v1/events": ["./content/issues/*.json"],
  },
};

export default nextConfig;
