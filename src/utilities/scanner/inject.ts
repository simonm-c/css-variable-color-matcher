import { scanFrameColorVariables } from "./index.js";

(globalThis as Record<string, unknown>).__cssVarScanResult = scanFrameColorVariables();
