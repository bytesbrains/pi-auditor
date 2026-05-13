/**
 * File utilities — walk directories, count LOC/exports/functions.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".pyi", ".pyx", ".go", ".rs", ".java", ".kt", ".kts",
  ".rb", ".swift", ".c", ".h", ".cpp", ".hpp", ".cc", ".hh",
  ".cs", ".php", ".scala", ".ex", ".exs", ".elm",
  ".vue", ".svelte", ".sql", ".graphql", ".gql", ".prisma",
]);

const IGNORE_PATTERNS = [
  "node_modules", "dist", ".git", "__pycache__",
  ".next", "build", "target", "vendor", ".turbo",
  "coverage", ".nyc_output",
];

export function isCodeFile(filePath: string): boolean {
  const ext = getExtension(filePath);
  return CODE_EXTENSIONS.has(ext) && ext !== ".d.ts";
}

export function getExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".ts" && filePath.endsWith(".d.ts")) return ".d.ts";
  return ext;
}

export function getLanguage(filePath: string): string {
  const langMap: Record<string, string> = {
    ".ts": "TypeScript", ".tsx": "TSX", ".js": "JavaScript", ".jsx": "JSX",
    ".py": "Python", ".go": "Go", ".rs": "Rust", ".java": "Java",
    ".kt": "Kotlin", ".rb": "Ruby", ".swift": "Swift",
    ".c": "C", ".h": "C Header", ".cpp": "C++", ".hpp": "C++ Header",
    ".cs": "C#", ".php": "PHP", ".scala": "Scala",
    ".ex": "Elixir", ".elm": "Elm", ".vue": "Vue", ".svelte": "Svelte",
    ".sql": "SQL", ".graphql": "GraphQL", ".prisma": "Prisma",
    ".d.ts": "Type Declarations",
  };
  return langMap[getExtension(filePath)] || getExtension(filePath).slice(1).toUpperCase() || "Unknown";
}

export function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    let count = 0;
    for (let i = 0; i < content.length; i++) if (content[i] === "\n") count++;
    return content.length > 0 && content[content.length - 1] !== "\n" ? count + 1 : count;
  } catch {
    return 0;
  }
}

export function countExports(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const matches = content.match(/^export /gm);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

export function countFunctions(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const patterns = [
      /function\s+\w+/g,
      /const\s+\w+\s*=\s*(?:async\s*)?\(/g,
      /const\s+\w+\s*=\s*(?:async\s*)?\w+\s*=>/g,
      /^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm,
    ];
    const names = new Set<string>();
    for (const pattern of patterns) {
      for (const match of content.matchAll(pattern)) {
        names.add(match[1] || match[0].replace(/function\s+/, ""));
      }
    }
    return names.size;
  } catch {
    return 0;
  }
}

export function shouldIgnore(filePath: string, extraIgnores: string[] = []): boolean {
  const parts = filePath.split(path.sep);
  const fileName = parts[parts.length - 1];

  for (const part of parts) {
    if (IGNORE_PATTERNS.includes(part)) return true;
  }

  // Check extra ignore patterns (support * wildcard like *.generated.*)
  for (const pattern of extraIgnores) {
    if (pattern.includes("*")) {
      const regex = new RegExp(
        "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$"
      );
      if (regex.test(fileName)) return true;
      if (regex.test(filePath)) return true;
    } else {
      // Exact match against path segments or full path
      if (parts.includes(pattern)) return true;
      if (filePath.includes(pattern)) return true;
    }
  }

  return false;
}

export function walkFiles(
  dir: string,
  extraIgnores: string[] = [],
  extensions: Set<string> = CODE_EXTENSIONS,
): string[] {
  const results: string[] = [];

  function walk(current: string) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!shouldIgnore(fullPath, extraIgnores)) walk(fullPath);
      } else if (entry.isFile()) {
        if (extensions.has(getExtension(fullPath)) && !shouldIgnore(fullPath, extraIgnores)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}
