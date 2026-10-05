import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pdf-parse", "tesseract.js", "exceljs"],
};

export default nextConfig;
