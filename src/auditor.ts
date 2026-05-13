/**
 * Auditor — analyzes repository files for RAG digestibility.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { DoctorConfig, FileAudit, GodFile, AuditReport, SizeBucket } from "./types.js";
import { walkFiles, countLines, countExports, countFunctions, getExtension, getLanguage } from "./file-utils.js";

const SIZE_BUCKETS: SizeBucket[] = [
  { label: "0–50", min: 0, max: 50 },
  { label: "51–100", min: 51, max: 100 },
  { label: "101–200", min: 101, max: 200 },
  { label: "201–500", min: 201, max: 500 },
  { label: "501–1000", min: 501, max: 1000 },
  { label: "1000+", min: 1001, max: Infinity },
];

function suggestSplit(file: FileAudit): string[] {
  const suggestions: string[] = [];
  const base = file.path.replace(/\.[^.]+$/, "");
  const dir = path.dirname(file.path);
  const basename = path.basename(base);
  const ext = path.extname(file.path);

  if (file.exports > 3) {
    suggestions.push(`Split by exports into ${dir}/${basename}/ (${file.exports} exports found)`);
  }
  if (file.loc > 500) {
    suggestions.push(`Extract into ${dir}/${basename}/ with focused modules (hooks, utils, components)`);
  }
  const testPath = base + `.test${ext}`;
  if (!fs.existsSync(testPath)) {
    suggestions.push(`⚠ No test file found — add ${path.basename(testPath)}`);
  }
  return suggestions;
}

export function auditRepo(
  cwd: string,
  config: DoctorConfig,
  targetPath?: string,
): AuditReport {
  const scanDir = targetPath ? path.resolve(cwd, targetPath) : cwd;
  const extraIgnores = config.files?.ignore || [];

  const allFiles = walkFiles(scanDir, extraIgnores);
  const files: FileAudit[] = [];
  const godFiles: GodFile[] = [];
  const sizeBuckets = SIZE_BUCKETS.map((b) => ({ ...b, count: 0 }));
  const languageMap = new Map<string, number>();
  let totalLoc = 0;
  let totalFunctions = 0;
  let totalExports = 0;

  for (const filePath of allFiles) {
    const loc = countLines(filePath);
    const fileExports = countExports(filePath);
    const fileFunctions = countFunctions(filePath);
    const lang = getLanguage(filePath);
    const relativePath = path.relative(cwd, filePath);

    const audit: FileAudit = {
      path: relativePath,
      loc,
      exports: fileExports,
      functions: fileFunctions,
      language: lang,
      extension: getExtension(filePath),
    };

    files.push(audit);
    totalLoc += loc;
    totalFunctions += fileFunctions;
    totalExports += fileExports;
    languageMap.set(lang, (languageMap.get(lang) || 0) + 1);

    for (const bucket of sizeBuckets) {
      if (loc >= bucket.min && loc <= bucket.max) {
        bucket.count++;
        break;
      }
    }

    if (loc > config.files.maxLines) {
      godFiles.push({
        ...audit,
        severity: loc > config.files.criticalLines ? "critical" : "warning",
        chunkEstimate: Math.ceil(loc / 20),
        splitSuggestions: suggestSplit(audit),
      });
    }
  }

  godFiles.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return b.loc - a.loc;
  });

  const totalFiles = allFiles.length;
  const goodFiles = totalFiles - godFiles.length;
  const criticalCount = godFiles.filter((g) => g.severity === "critical").length;
  const warningCount = godFiles.filter((g) => g.severity === "warning").length;

  let digestibility: "good" | "warning" | "poor";
  if (totalFiles === 0) {
    digestibility = "good";
  } else if (criticalCount === 0 && warningCount / totalFiles < 0.05) {
    digestibility = "good";
  } else if (criticalCount / totalFiles < 0.03) {
    digestibility = "warning";
  } else {
    digestibility = "poor";
  }

  return {
    scanDir,
    totalFiles,
    totalLoc,
    totalFunctions,
    totalExports,
    digestibility,
    goodFiles,
    warningCount,
    criticalCount,
    goodPercent: totalFiles > 0 ? Math.round((goodFiles / totalFiles) * 1000) / 10 : 100,
    sizeBuckets,
    languages: Array.from(languageMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    godFiles,
    maxLines: config.files.maxLines,
    criticalLines: config.files.criticalLines,
  };
}
