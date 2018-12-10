/* global test, expect, describe */
import {
  writeFileSync,
  statSync,
  readdirSync,
  emptyDirSync,
  ensureDirSync,
} from "fs-extra";
import { join, resolve } from "path";
import { transformFileSync } from "@babel/core";
import { get as getOpts } from "./options";
import plugin from "../src";

const FIXTURE_DIR_NAME = "fixtures";
const OUT_DIR_NAME = "__output__";

emptyDirSync(join(__dirname, OUT_DIR_NAME));

function processDirectory(dir) {
  const items = readdirSync(dir);
  // Process Files first
  items
    .filter(item => item.endsWith(".js") || item.endsWith(".ts"))
    .forEach(filename => {
      test(filename, () => {
        const filePath = join(dir, filename);
        let outputPath = filePath.replace(FIXTURE_DIR_NAME, OUT_DIR_NAME);
        try {
          const opts = getOpts(filePath);
          const presets = [];

          if (filePath.endsWith(".ts")) {
            presets.push(["@babel/preset-typescript"]);
          }

          if (filePath.includes("flow")) {
            presets.push(["@babel/preset-flow"]);
          }

          if (filePath.includes("preset-env")) {
            presets.push([
              "@babel/preset-env",
              {
                // default targets for preset-env is ES5
              },
            ]);
          }
          const result = transformFileSync(filePath, {
            plugins: [
              "@babel/plugin-syntax-dynamic-import",
              "@babel/plugin-syntax-object-rest-spread",
              ["@babel/plugin-syntax-decorators", { legacy: true }],
              ["@babel/plugin-syntax-class-properties", { useBuiltIns: true }],
              [plugin, opts],
            ],
            presets,
            sourceRoot: __dirname,
            comments: false,
            babelrc: false,
          }).code;

          ensureDirSync(dir.replace(FIXTURE_DIR_NAME, OUT_DIR_NAME)); // This is delayed for when we run with a filter.
          writeFileSync(outputPath, result); // For manual verification

          if (filePath.includes("-error-")) {
            throw new Error(`Expected ${filename} to throw error`);
          }
          // if (!opts.allowMixedExports && result.includes(`"__esModule"`)) {
          //   throw new Error(`Unexpected __esModule declaration in ${filename}`)
          // }
          if (!filePath.includes("_private_")) {
            expect(result).toMatchSnapshot();
          }
        } catch (error) {
          if (filename.includes("error-")) {
            const message = error.message
              .replace(filePath, "")
              .replace(": ", "");
            outputPath = outputPath.replace(".js", ".txt");
            expect(message).toMatchSnapshot();
            ensureDirSync(dir.replace(FIXTURE_DIR_NAME, OUT_DIR_NAME)); // This is delayed for when we run with a filter.
            writeFileSync(outputPath, message); // For manual verification
          } else {
            throw error;
          }
        }
      });
    });

  // Recurse into directories
  items
    .map(name => ({ name, path: join(dir, name) }))
    .filter(item => statSync(item.path).isDirectory())
    .forEach(item => {
      describe(item.name, () => {
        processDirectory(item.path);
      });
    });
}

(() => {
  processDirectory(resolve(__dirname, FIXTURE_DIR_NAME));
})();
