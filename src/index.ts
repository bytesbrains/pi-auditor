/**
 * context-engineer-doctor — pi extension
 *
 * Analyzes repository files for RAG digestibility and context engineering.
 * Flags "god files" that fragment poorly in vector indexes.
 *
 * Commands:
 *   /doctor:audit              Full digestibility report
 *   /doctor:god-files [--threshold N]  List oversized files
 *   /doctor:rules [init|show|set <key> <value>]  Manage .doctorrc.yml
 *
 * Tools (LLM-callable):
 *   doctor_audit               Run audit and return structured report
 *   doctor_check_file <path>   Audit a single file for RAG compatibility
 *
 * Place this extension at: .pi/extensions/doctor/index.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { auditRepo } from "./auditor.js";
import { getConfig, initConfig, setConfig } from "./rules.js";
import { formatReport, formatGodFiles } from "./formatters.js";

// ── Extension ──

export default function (pi: ExtensionAPI) {
  // ═══════════════════════════════════════════════════════════════
  // Command: /doctor:audit
  // ═══════════════════════════════════════════════════════════════
  pi.registerCommand("doctor:audit", {
    description: "Full repository digestibility audit for RAG compatibility",
    handler: async (_args, ctx) => {
      const config = getConfig(ctx.cwd);
      const report = auditRepo(ctx.cwd, config);
      const output = formatReport(report);

      ctx.ui.notify(output, "info");
    },
  });

  // ═══════════════════════════════════════════════════════════════
  // Command: /doctor:god-files [--threshold N]
  // ═══════════════════════════════════════════════════════════════
  pi.registerCommand("doctor:god-files", {
    description: "List files exceeding the LOC threshold with split suggestions",
    handler: async (args, ctx) => {
      const config = getConfig(ctx.cwd);
      const report = auditRepo(ctx.cwd, config);

      let threshold: number | undefined;
      const thresholdMatch = args?.match(/--threshold\s+(\d+)/);
      if (thresholdMatch) {
        threshold = parseInt(thresholdMatch[1], 10);
      }

      const output = formatGodFiles(report, threshold);
      ctx.ui.notify(output, "info");
    },
  });

  // ═══════════════════════════════════════════════════════════════
  // Command: /doctor:rules [init|show|set <key> <value>]
  // ═══════════════════════════════════════════════════════════════
  pi.registerCommand("doctor:rules", {
    description: "Manage .doctorrc.yml configuration",
    handler: async (args, ctx) => {
      const trimmed = args?.trim() || "";

      // Init
      if (!trimmed || trimmed === "init") {
        const config = initConfig(ctx.cwd);
        ctx.ui.notify(
          [
            "✓ .doctorrc.yml created/loaded",
            "",
            `  files.maxLines: ${config.files.maxLines}     # warn above this LOC`,
            `  files.criticalLines: ${config.files.criticalLines} # error above this LOC`,
            `  files.ignore: ${(config.files.ignore || []).join(", ") || "(none)"}`,
            "",
            "Manage with: /doctor:rules set files.maxLines 150",
          ].join("\n"),
          "info",
        );
        return;
      }

      // Show
      if (trimmed === "show") {
        const config = getConfig(ctx.cwd);
        ctx.ui.notify(
          [
            "Current .doctorrc.yml:",
            "",
            `  files.maxLines: ${config.files.maxLines}`,
            `  files.criticalLines: ${config.files.criticalLines}`,
            `  files.ignore: ${(config.files.ignore || []).join(", ") || "(none)"}`,
          ].join("\n"),
          "info",
        );
        return;
      }

      // Set
      if (trimmed.startsWith("set ")) {
        const setArgs = trimmed.slice(4).trim().split(/\s+/);
        if (setArgs.length < 2) {
          ctx.ui.notify(
            "Usage: /doctor:rules set <key> <value>\n  e.g. /doctor:rules set files.maxLines 150",
            "error",
          );
          return;
        }

        const key = setArgs[0];
        const rawValue = setArgs[1];
        const numValue = parseInt(rawValue, 10);
        const value = isNaN(numValue) ? rawValue : numValue;

        const result = setConfig(ctx.cwd, key, value);
        if ("error" in result) {
          ctx.ui.notify(result.error, "error");
        } else {
          ctx.ui.notify(
            `✓ ${result.key}: ${result.oldValue} → ${result.newValue}`,
            "info",
          );
        }
        return;
      }

      ctx.ui.notify(
        "Usage:\n  /doctor:rules init           Create .doctorrc.yml\n  /doctor:rules show           Show current config\n  /doctor:rules set <k> <v>    Change a setting",
        "info",
      );
    },
  });

  // ═══════════════════════════════════════════════════════════════
  // Tool: doctor_audit — LLM-callable
  // ═══════════════════════════════════════════════════════════════
  pi.registerTool({
    name: "doctor_audit",
    label: "Doctor Audit",
    description:
      "Audit the repository for RAG digestibility. Returns files exceeding LOC thresholds, size distribution, and recommendations.",
    parameters: Type.Object({
      threshold: Type.Optional(
        Type.Number({
          description: "Override the max lines threshold (default: from .doctorrc.yml)",
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const config = getConfig(ctx.cwd);
      if (params.threshold) {
        config.files.maxLines = params.threshold;
      }
      const report = auditRepo(ctx.cwd, config);
      return {
        content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
        details: report,
      };
    },
  });

  // ═══════════════════════════════════════════════════════════════
  // Tool: doctor_check_file — single file audit
  // ═══════════════════════════════════════════════════════════════
  pi.registerTool({
    name: "doctor_check_file",
    label: "Check File",
    description:
      "Check a single file for RAG compatibility. Returns LOC, export count, function count, and whether it exceeds the configured limits.",
    parameters: Type.Object({
      path: Type.String({ description: "Relative path to the file to check" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const config = getConfig(ctx.cwd);
      const report = auditRepo(ctx.cwd, config, params.path);

      if (report.totalFiles === 0) {
        return {
          content: [{ type: "text", text: `File not found or not a code file: ${params.path}` }],
          details: null,
        };
      }

      const file = report.godFiles[0] ||
        // Find the file in the full audit (it's under the threshold)
        ({
          path: params.path,
          loc: 0,
          exports: 0,
          functions: 0,
          language: "Unknown",
          extension: "",
          severity: "warning" as const,
          chunkEstimate: 0,
          splitSuggestions: [],
        });

      const withinLimit = report.godFiles.length === 0;
      const status = withinLimit
        ? `✓ Within limit (≤${config.files.maxLines} LOC)`
        : `✗ Exceeds limit (>${config.files.maxLines} LOC)`;

      return {
        content: [
          {
            type: "text",
            text: [
              `${status}`,
              `  Path: ${file.path}`,
              `  LOC: ${file.loc}`,
              `  Exports: ${file.exports}`,
              `  Functions: ${file.functions}`,
              `  Language: ${file.language}`,
              `  Threshold: ${config.files.maxLines} LOC`,
            ].join("\n"),
          },
        ],
        details: file,
      };
    },
  });
}
