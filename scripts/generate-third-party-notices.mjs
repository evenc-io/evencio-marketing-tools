import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "node_modules");
const outFile = path.resolve(process.cwd(), "THIRD_PARTY_NOTICES.md");
const licenseFileNames = [
  "LICENSE",
  "LICENSE.md",
  "LICENSE.txt",
  "LICENCE",
  "LICENCE.md",
  "LICENCE.txt",
  "COPYING",
  "COPYING.md",
  "COPYING.txt",
  "COPYRIGHT",
];

const findLicenseFile = (dir) => {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const names = new Set(entries.filter((e) => e.isFile()).map((e) => e.name));
    for (const name of licenseFileNames) {
      if (names.has(name)) return path.join(dir, name);
    }
    const lower = new Map();
    for (const name of names) lower.set(name.toLowerCase(), name);
    for (const name of licenseFileNames) {
      const hit = lower.get(name.toLowerCase());
      if (hit) return path.join(dir, hit);
    }
  } catch {
    return null;
  }
  return null;
};

const normalizeRepo = (repo) => {
  if (!repo) return "";
  if (typeof repo === "string") return repo;
  if (typeof repo === "object" && typeof repo.url === "string") return repo.url;
  return "";
};

const seen = new Map();

const walk = (dir) => {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(p);
      continue;
    }
    if (!ent.isFile() || ent.name !== "package.json") continue;

    let data;
    try {
      data = JSON.parse(fs.readFileSync(p, "utf8"));
    } catch {
      continue;
    }

    const name = data.name || "";
    const version = data.version || "";
    if (!name || !version) continue;

    const key = `${name}@${version}`;
    if (seen.has(key)) continue;

    const license = data.license
      ? typeof data.license === "string"
        ? data.license
        : data.license.type || ""
      : "";
    const licenses = Array.isArray(data.licenses)
      ? data.licenses
          .map((item) =>
            typeof item === "string" ? item : item && item.type ? item.type : "",
          )
          .filter(Boolean)
      : [];
    const licenseValue = license || (licenses.length ? licenses.join(", ") : "UNKNOWN");
    const repo = normalizeRepo(data.repository) || data.homepage || "";
    const pkgDir = path.dirname(p);
    const licenseFile = findLicenseFile(pkgDir);

    seen.set(key, {
      name,
      version,
      license: licenseValue,
      repo,
      licenseFile: licenseFile || "",
    });
  }
};

if (!fs.existsSync(root)) {
  console.error("node_modules not found. Run bun install first.");
  process.exit(1);
}

walk(root);

const items = Array.from(seen.values()).sort((a, b) => {
  const an = a.name.toLowerCase();
  const bn = b.name.toLowerCase();
  if (an < bn) return -1;
  if (an > bn) return 1;
  if (a.version < b.version) return -1;
  if (a.version > b.version) return 1;
  return 0;
});

let out = "";
out += "# Third-Party Notices\n\n";
out += "This file lists third-party packages included via npm dependencies and their declared licenses.\n";
out += "Refer to each package's own license file for the full terms.\n\n";

for (const item of items) {
  out += `## ${item.name}@${item.version}\n`;
  out += `- License: ${item.license || "UNKNOWN"}\n`;
  if (item.repo) out += `- Repository: ${item.repo}\n`;
  if (item.licenseFile) out += `- License file: ${item.licenseFile}\n`;
  out += "\n";
}

fs.writeFileSync(outFile, out);
console.log(`Wrote ${path.relative(process.cwd(), outFile)} with ${items.length} entries.`);
