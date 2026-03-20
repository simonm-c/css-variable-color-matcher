import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "istanbul",
      include: [
        "src/composables/useChrome/index.ts",
        "src/composables/useColorMatcher/index.ts",
        "src/utilities/colorParsing/index.ts",
        "src/utilities/scanner/index.ts",
        "src/utilities/popupRenderer/index.ts",
        "src/utilities/eyedropperHandler/index.ts",
        "src/utilities/panelWindowManager/index.ts",
        "src/entries/popup/index.ts",
      ],
      all: true,
    },
  },
});
