/**
 * Report formatters — render audit results as human-readable text.
 */

import type { AuditReport } from "./types.js";

const BAR_CHARS = ["▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];

function barChart(value: number, max: number, width: number = 30): string {
  const fraction = max > 0 ? value / max : 0;
  const fullBlocks = Math.floor(fraction * width);
  const partialIndex = Math.floor((fraction * width - fullBlocks) * 8);
  const partial = partialIndex > 0 ? BAR_CHARS[partialIndex] : "";
  return "█".repeat(fullBlocks) + partial;
}

export function formatReport(report: AuditReport): string {
  const icon =
    report.digestibility === "good"
      ? "✓"
      : report.digestibility === "warning"
        ? "⚠"
        : "✗";

  const maxBucket = Math.max(...report.sizeBuckets.map((b) => b.count), 1);
  const pct = (n: number) =>
    report.totalFiles > 0 ? `(${Math.round((n / report.totalFiles) * 100)}%)` : "";

  const lines: string[] = [
    `📊 Digestibility Report  —  ${icon} ${report.digestibility.toUpperCase()}`,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `  Files analyzed:          ${report.totalFiles}`,
    `  Total LOC:               ${report.totalLoc.toLocaleString()}`,
    `  Total functions:         ${report.totalFunctions}`,
    `  Total exports:           ${report.totalExports}`,
    "",
    `  RAG-friendly (≤${report.maxLines} LOC): ${report.goodFiles} (${report.goodPercent}%)  ${icon}`,
    `  Warning (${report.maxLines + 1}–${report.criticalLines} LOC):    ${report.warningCount} (${Math.round((report.warningCount / report.totalFiles) * 1000) / 10 || 0}%)  ⚠`,
    `  Critical (>${report.criticalLines} LOC):   ${report.criticalCount} (${Math.round((report.criticalCount / report.totalFiles) * 1000) / 10 || 0}%)  ✗`,
    "",
    `📈 File Size Distribution`,
    "",
  ];

  for (const bucket of report.sizeBuckets) {
    if (bucket.count === 0) continue;
    lines.push(`  ${bucket.label.padEnd(9)} ${barChart(bucket.count, maxBucket)} ${bucket.count} ${pct(bucket.count)}`);
  }

  lines.push("");
  if (report.languages.length > 0) {
    lines.push(`🌐 Languages: ${report.languages.map((l) => `${l.name} (${l.count})`).join(", ")}`);
    lines.push("");
  }

  if (report.godFiles.length > 0) {
    lines.push(`⚠ Top ${Math.min(10, report.godFiles.length)} God Files:`);
    lines.push("");
    lines.push(`  ${"Rank".padEnd(5)} ${"File".padEnd(45)} ${"LOC".padEnd(7)} ${"Chunks".padEnd(7)} Severity`);
    lines.push(`  ${"────".padEnd(5)} ${"────".padEnd(45)} ${"───".padEnd(7)} ${"──────".padEnd(7)} ────────`);

    for (const [i, gf] of report.godFiles.slice(0, 10).entries()) {
      const rank = `${i + 1}`.padEnd(5);
      const fileDisplay = gf.path.length > 45 ? "..." + gf.path.slice(-42) : gf.path.padEnd(45);
      const sev = gf.severity === "critical" ? "CRITICAL" : "WARNING";
      lines.push(`  ${rank} ${fileDisplay} ${String(gf.loc).padEnd(7)} ${String(gf.chunkEstimate).padEnd(7)} ${sev}`);
    }

    if (report.godFiles.length > 10) {
      lines.push(`  ... and ${report.godFiles.length - 10} more (use /doctor:god-files for full list)`);
    }
    lines.push("");
    lines.push(`🩺 Assessment: ${report.criticalCount} critical files exceed the ${report.criticalLines}-LOC limit.`);
    lines.push(`   These ${report.godFiles.length} files (${Math.round((report.godFiles.length / report.totalFiles) * 1000) / 10 || 0}% of total) produce fragmented chunks.`);
    lines.push(`   → Run /doctor:god-files for detailed split suggestions.`);
  } else {
    lines.push(`🩺 Assessment: No god files detected. This repo is RAG-ready.`);
  }

  return lines.join("\n");
}

export function formatGodFiles(report: AuditReport, threshold?: number): string {
  const filterLoc = threshold ?? report.maxLines;
  const filtered = report.godFiles.filter((gf) => gf.loc > filterLoc);

  if (filtered.length === 0) return `✓ No files exceed ${filterLoc} LOC. Repo is clean.`;

  const lines: string[] = [`GOD FILES (>${filterLoc} LOC) — ${filtered.length} files`, ""];

  for (const gf of filtered.slice(0, 15)) {
    const icon = gf.severity === "critical" ? "✗" : "⚠";
    lines.push(`${icon} ${gf.path}`);
    lines.push(`     ${gf.loc.toLocaleString()} lines | ${gf.exports} exports | ${gf.functions} functions | ${gf.chunkEstimate} estimated chunks`);
    if (gf.splitSuggestions.length > 0) {
      lines.push(`     Suggestions:`);
      for (const s of gf.splitSuggestions) lines.push(`       → ${s}`);
    }
    lines.push("");
  }

  if (filtered.length > 15) {
    lines.push(`  ... and ${filtered.length - 15} more (raise threshold: /doctor:rules set files.maxLines <N>)`);
  }

  return lines.join("\n");
}
