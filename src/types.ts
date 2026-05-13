/**
 * Shared types for the doctor extension.
 */

export interface DoctorConfig {
  files: {
    maxLines: number;
    criticalLines: number;
    ignore?: string[];
  };
}

export interface FileAudit {
  path: string;
  loc: number;
  exports: number;
  functions: number;
  language: string;
  extension: string;
}

export interface GodFile extends FileAudit {
  severity: "warning" | "critical";
  chunkEstimate: number;
  splitSuggestions: string[];
}

export interface SizeBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface AuditReport {
  scanDir: string;
  totalFiles: number;
  totalLoc: number;
  totalFunctions: number;
  totalExports: number;
  digestibility: "good" | "warning" | "poor";
  goodFiles: number;
  warningCount: number;
  criticalCount: number;
  goodPercent: number;
  sizeBuckets: SizeBucket[];
  languages: { name: string; count: number }[];
  godFiles: GodFile[];
  maxLines: number;
  criticalLines: number;
}
