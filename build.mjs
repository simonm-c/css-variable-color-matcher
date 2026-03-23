import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

/** @type {esbuild.BuildOptions[]} */
const configs = [
  {
    entryPoints: ["src/entries/popup/index.ts"],
    outfile: "dist/entries/popup/index.js",
    bundle: true,
    format: "esm",
  },
  {
    entryPoints: ["src/utilities/scanner/inject.ts"],
    outfile: "dist/utilities/scanner/inject.js",
    bundle: true,
    format: "iife",
  },
  {
    entryPoints: ["src/utilities/eyedropperHandler/index.ts"],
    outfile: "dist/utilities/eyedropperHandler/index.js",
    bundle: true,
    format: "iife",
  },
  {
    entryPoints: ["src/utilities/panelWindowManager/index.ts"],
    outfile: "dist/utilities/panelWindowManager/index.js",
    bundle: true,
    format: "iife",
  },
];

const shared = { target: "es2020", logLevel: "info" };

if (watch) {
  const contexts = await Promise.all(
    configs.map((c) => esbuild.context({ ...shared, ...c })),
  );
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log("Watching for changes…");
} else {
  await Promise.all(configs.map((c) => esbuild.build({ ...shared, ...c })));
}
