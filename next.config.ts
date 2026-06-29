import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/fichaje",
  serverExternalPackages: ["pdfkit", "exceljs"],
};

export default nextConfig;
