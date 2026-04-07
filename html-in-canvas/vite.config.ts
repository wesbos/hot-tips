import { defineConfig } from "vite-plus";
import typegpuPlugin from "unplugin-typegpu/vite";

export default defineConfig({
  fmt: {},
  lint: {
    ignorePatterns: ["src-old/**", "demos/**"],
    options: { typeAware: true, typeCheck: true },
  },
  plugins: [typegpuPlugin({})],
});
