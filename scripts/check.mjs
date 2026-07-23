#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const manifest = readJson("manifest.json");
const packageJson = readJson("package.json");
const lockJson = readJson("package-lock.json");
const failures = [];
const excludedDirectories = new Set([".git", "dist", "node_modules", "__pycache__", ".pytest_cache"]);
const projectFiles = walk(root, excludedDirectories);
const runtimeFiles = walk(join(root, "src"), excludedDirectories);

checkManifest();
checkProjectFiles();
checkRuntimeSource();
checkReferences();
checkSyntax();
checkDocumentationLinks();
checkIcons();

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

const jsCount = projectFiles.filter((path) => [".js", ".cjs", ".mjs"].includes(extname(path))).length;
console.log(`check passed: ${jsCount} JavaScript files, ${projectFiles.length} audited project files, ${manifestReferences().size} manifest references`);

function checkManifest() {
  if (manifest.manifest_version !== 3) failures.push("manifest_version must be 3");
  if (manifest.version !== packageJson.version) failures.push("manifest and package versions differ");
  if (lockJson.version !== packageJson.version || lockJson.packages?.[""]?.version !== packageJson.version) {
    failures.push("package-lock and package versions differ");
  }
  if (JSON.stringify(manifest.permissions || []) !== JSON.stringify(["storage"])) {
    failures.push("runtime permissions must remain limited to storage");
  }
  if (manifest.host_permissions?.length) failures.push("API origins must not be required host permissions");
  if (manifest.web_accessible_resources?.length) failures.push("no page-accessible resources should be exposed");
  if (manifest.externally_connectable) failures.push("external extension messaging must not be enabled");

  const expectedOptionalHosts = new Set([
    "https://*/*",
    "http://localhost/*",
    "http://127.0.0.1/*"
  ]);
  const actualOptionalHosts = new Set(manifest.optional_host_permissions || []);
  if (!sameStringSet(actualOptionalHosts, expectedOptionalHosts)) {
    failures.push("optional host permissions must remain limited to HTTPS APIs and local HTTP development APIs");
  }

  const expectedContentHosts = new Set([
    "https://x.com/*",
    "https://twitter.com/*"
  ]);
  const actualContentHosts = new Set((manifest.content_scripts || []).flatMap((entry) => entry.matches || []));
  if (!sameStringSet(actualContentHosts, expectedContentHosts)) {
    failures.push("content script hosts must remain limited to X");
  }

  const worker = manifest.background?.service_worker;
  if (!worker || manifest.background?.type === "module") {
    failures.push("background must remain a classic MV3 service worker because it uses importScripts");
  }

  for (const path of manifestReferences()) {
    if (!exists(path)) failures.push(`manifest references a missing file: ${path}`);
  }
}

function checkProjectFiles() {
  const fontExtensions = new Set([".ttf", ".otf", ".woff", ".woff2", ".eot"]);
  const secretPatterns = [
    [/sk-[A-Za-z0-9_-]{16,}/, "OpenAI-style credential-like token"],
    [/xai-[A-Za-z0-9_-]{16,}/i, "xAI-style credential-like token"],
    [/(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/, "GitHub credential-like token"],
    [/AIza[0-9A-Za-z_-]{30,}/, "Google API credential-like token"],
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key material"],
    [/Bearer\s+[A-Za-z0-9._-]{20,}/i, "literal bearer credential"],
    [/sub\.muxing\.cfd/i, "legacy proxy endpoint"]
  ];

  for (const path of projectFiles) {
    const relativePath = relative(root, path);
    if (fontExtensions.has(extname(path).toLowerCase())) {
      failures.push(`font files must not be distributed: ${relativePath}`);
    }
    const data = readFileSync(path);
    const text = data.toString("utf8");
    for (const [pattern, label] of secretPatterns) {
      if (pattern.test(text)) failures.push(`${label} found in ${relativePath}`);
    }
    if (extname(path) === ".json") {
      try {
        JSON.parse(text);
      } catch (error) {
        failures.push(`invalid JSON in ${relativePath}: ${error.message}`);
      }
    }
  }
}

function checkRuntimeSource() {
  const sourceText = runtimeFiles
    .filter((path) => [".js", ".html", ".css"].includes(extname(path)))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  const forbidden = [
    [/变蠢处方|启用纠正助手|正在纠正信息流|会让你变蠢/, "legacy runtime language found"],
    [/<script[^>]+src=["']https?:\/\//i, "remote hosted script found"],
    [/<link\b(?=[^>]*\brel=["'][^"']*stylesheet)(?=[^>]*\bhref=["'](?:https?:)?\/\/)[^>]*>/i, "remote hosted stylesheet found"],
    [/@import\s+(?:url\()?\s*["']?(?:https?:)?\/\//i, "remote stylesheet import found"],
    [/\b(?:src|href)\s*=\s*["']javascript:/i, "javascript URL found in runtime markup"]
  ];
  for (const [pattern, message] of forbidden) {
    if (pattern.test(sourceText)) failures.push(message);
  }
}

function checkReferences() {
  for (const htmlPath of runtimeFiles.filter((path) => extname(path) === ".html")) {
    const html = readFileSync(htmlPath, "utf8");
    for (const match of html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)=["']([^"']+)["']/gi)) {
      const reference = match[1];
      if (isExternalReference(reference)) continue;
      const target = resolve(dirname(htmlPath), reference.split(/[?#]/)[0]);
      if (!statSafe(target)?.isFile()) {
        failures.push(`${relative(root, htmlPath)} references missing file ${reference}`);
      }
    }
  }

  for (const cssPath of runtimeFiles.filter((path) => extname(path) === ".css")) {
    const css = readFileSync(cssPath, "utf8");
    for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      const reference = match[1];
      if (isExternalReference(reference) || reference.startsWith("data:")) continue;
      const target = resolve(dirname(cssPath), reference.split(/[?#]/)[0]);
      if (!statSafe(target)?.isFile()) {
        failures.push(`${relative(root, cssPath)} references missing file ${reference}`);
      }
    }
  }
}

function checkSyntax() {
  const jsFiles = projectFiles.filter((path) => [".js", ".cjs", ".mjs"].includes(extname(path)));
  for (const path of jsFiles) {
    try {
      execFileSync(process.execPath, ["--check", path], { stdio: "pipe" });
    } catch (error) {
      failures.push(`syntax check failed: ${relative(root, path)}\n${String(error.stderr || error.message)}`);
    }
  }

  const pythonFiles = projectFiles.filter((path) => extname(path) === ".py");
  if (pythonFiles.length) {
    try {
      execFileSync("python3", [
        "-c",
        "import ast, pathlib, sys; [ast.parse(pathlib.Path(p).read_text(encoding='utf-8'), filename=p) for p in sys.argv[1:]]",
        ...pythonFiles
      ], { stdio: "pipe" });
    } catch (error) {
      failures.push(`Python syntax check failed\n${String(error.stderr || error.message)}`);
    }
  }
}

function checkDocumentationLinks() {
  for (const markdownPath of projectFiles.filter((path) => extname(path) === ".md")) {
    const markdown = readFileSync(markdownPath, "utf8");
    for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const raw = match[1].trim().replace(/^<|>$/g, "");
      if (!raw || isExternalReference(raw) || raw.startsWith("#")) continue;
      const reference = raw.split(/[?#]/)[0];
      if (!reference) continue;
      const target = resolve(dirname(markdownPath), reference);
      if (!statSafe(target)) failures.push(`${relative(root, markdownPath)} links to missing path ${raw}`);
    }
  }
}

function checkIcons() {
  const expected = new Map([
    ["assets/icon-16.png", 16],
    ["assets/icon-32.png", 32],
    ["assets/icon-48.png", 48],
    ["assets/icon-128.png", 128]
  ]);
  const actualAssets = projectFiles
    .filter((path) => relative(root, path).startsWith(`assets${process.platform === "win32" ? "\\" : "/"}`))
    .map((path) => relative(root, path).replaceAll("\\", "/"));
  for (const path of actualAssets) {
    if (!expected.has(path)) failures.push(`unreviewed runtime asset found: ${path}`);
  }
  for (const [path, size] of expected) {
    const dimensions = pngDimensions(join(root, path));
    if (!dimensions || dimensions.width !== size || dimensions.height !== size) {
      failures.push(`${path} must be a ${size}x${size} PNG`);
    }
  }
}

function manifestReferences() {
  return new Set([
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    manifest.options_page,
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {}),
    ...(manifest.content_scripts || []).flatMap((entry) => [...(entry.js || []), ...(entry.css || [])])
  ].filter(Boolean));
}

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function exists(path) {
  return Boolean(statSafe(join(root, path))?.isFile());
}

function statSafe(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function walk(directory, excluded = new Set()) {
  if (!statSafe(directory)?.isDirectory()) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && excluded.has(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path, excluded) : [path];
  });
}

function sameStringSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function isExternalReference(value) {
  return /^(?:https?:|mailto:|data:|javascript:|chrome:|chrome-extension:|\/\/)/i.test(value);
}

function pngDimensions(path) {
  try {
    const data = readFileSync(path);
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (data.length < 24 || !data.subarray(0, 8).equals(signature) || data.toString("ascii", 12, 16) !== "IHDR") return null;
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  } catch {
    return null;
  }
}
