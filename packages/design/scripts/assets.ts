// Writes what the package ships next to its code: `tokens.css` from the tokens, and `fonts.css`
// with the font files it points to, taken from the Fontsource packages. Only the Cyrillic and Latin
// subsets go in (Latin Extended holds «₽»); the sites that use the package serve the files
// themselves, since their Content-Security-Policy allows no fonts from elsewhere.

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { tokensCss } from "../src/css";

const require = createRequire(import.meta.url);

const fonts = [
  {
    pkg: "@fontsource-variable/wix-madefor-display",
    family: "Wix Madefor Display",
  },
  { pkg: "@fontsource-variable/wix-madefor-text", family: "Wix Madefor Text" },
  { pkg: "@fontsource-variable/jetbrains-mono", family: "JetBrains Mono" },
] as const;

const subsets = ["cyrillic", "latin-ext", "latin"];

interface Face {
  file: string;
  css: string;
}

/** The @font-face rules of one Fontsource stylesheet, kept for the subsets above and renamed. */
export function pickFaces(stylesheet: string, family: string): Face[] {
  const faces: Face[] = [];
  for (const rule of stylesheet.match(/@font-face\s*\{[^}]*\}/gu) ?? []) {
    const file = /url\(\.\/files\/([^)]+\.woff2)\)/u.exec(rule)?.[1];
    if (!file) continue;
    const subset = subsets.find((name) => file.includes(`-${name}-wght`));
    if (!subset) continue;
    faces.push({
      file,
      css: rule
        .replace(/font-family:[^;]+;/u, `font-family: "${family}";`)
        .replace(`url(./files/${file})`, `url(./fonts/${file})`),
    });
  }
  return faces;
}

export async function writeAssets(outDir: string): Promise<void> {
  await mkdir(join(outDir, "fonts"), { recursive: true });
  await writeFile(join(outDir, "tokens.css"), tokensCss());

  const rules: string[] = [
    "/* Seamlet fonts: Cyrillic and Latin only, font-display: swap. Licensed under the SIL OFL 1.1. */",
  ];
  for (const { pkg, family } of fonts) {
    const root = dirname(require.resolve(`${pkg}/package.json`));
    // Upright only: the look has no italics, and Wix Madefor Text has no Cyrillic italic to give.
    const stylesheet = await readFile(join(root, "wght.css"), "utf8");
    for (const face of pickFaces(stylesheet, family)) {
      await copyFile(
        join(root, "files", face.file),
        join(outDir, "fonts", face.file),
      );
      rules.push(face.css);
    }
    await copyFile(
      join(root, "LICENSE"),
      join(outDir, "fonts", `${family.replaceAll(" ", "-")}-LICENSE.txt`),
    );
  }
  await writeFile(join(outDir, "fonts.css"), `${rules.join("\n\n")}\n`);
}
