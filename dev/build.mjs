// 把站点源文件收进 dist/：GitHub Pages 用仓库根，Qoder Sites 的 webDirectory 要 dist/。
// 用法：deno run --allow-read --allow-write dev/build.mjs
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist");

const FILES = ["index.html", "admin.html", "manifest.json", ".nojekyll"];
const DIRS = ["assets/css", "assets/js", "assets/icon"];

async function copyTree(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const src = join(from, entry.name), dst = join(to, entry.name);
    if (entry.isDirectory()) await copyTree(src, dst);
    else if (entry.isFile()) await copyFile(src, dst);
  }
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const name of FILES) {
  try { await copyFile(join(root, name), join(out, name)); }
  catch { console.warn(`跳过缺失文件 ${name}`); }
}
for (const dir of DIRS) await copyTree(join(root, dir), join(out, dir));

// dist/ 部署在站点根，资源用相对路径；这里只做一次校验，防止有人写回绝对路径。
const html = await readFile(join(out, "index.html"), "utf8");
const absolute = html.match(/(?:src|href)="\/(?!\/)[^"]*"/g) || [];
if (absolute.length) throw new Error(`index.html 里有绝对路径，子目录部署会 404：${absolute.join(" ")}`);
await writeFile(join(out, "BUILD.txt"), `反刍打断静态产物。由 deno run --allow-read --allow-write dev/build.mjs 生成，请勿手工编辑。\n`);
console.log(`dist/ 就绪：${out}`);
