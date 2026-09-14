import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships .wasm/.data assets next to its JS. Bundling it breaks that
  // lookup, so it is loaded from node_modules at runtime instead. Only the
  // optional `DB_DRIVER=pglite` dev mode imports it.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
