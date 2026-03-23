import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

const certPath = path.resolve(__dirname, "../certs/cert.pem");
const keyPath = path.resolve(__dirname, "../certs/key.pem");
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

export default defineConfig({
  plugins: [react()],
  server: {
    https: hasCerts
      ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
      : false,
  },
  build: {
    outDir: "../public",
    emptyOutDir: true,
  },
});
