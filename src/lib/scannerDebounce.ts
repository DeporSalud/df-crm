/**
 * Hardware Scanner Debouncer (>= 2.5s)
 * Protects against optical card bounce, double reads, and rapid successive scans
 * from WebSocket OBZ RF-70 readers, USB keyboard wedges, and form submissions.
 * Compliant with Milestone 2 Requirement R1.3.
 */

export interface DebounceResult {
  accepted: boolean;
  reason: "PROCESSED" | "DEBOUNCE_BLOCKED" | "EMPTY_CODE";
  code?: string;
  timestamp?: number;
  elapsedMs?: number;
  thresholdMs?: number;
}

export class HardwareScannerDebouncer {
  private debounceMs: number;
  private lastCode: string | null = null;
  private lastTime: number = 0;

  constructor(debounceMs: number = 2500) {
    this.debounceMs = debounceMs;
  }

  public processScan(code: string, currentTime: number = Date.now()): DebounceResult {
    const raw = String(code || "").trim();
    if (!raw) {
      return { accepted: false, reason: "EMPTY_CODE" };
    }

    if (raw === this.lastCode && (currentTime - this.lastTime) < this.debounceMs) {
      return {
        accepted: false,
        reason: "DEBOUNCE_BLOCKED",
        elapsedMs: currentTime - this.lastTime,
        thresholdMs: this.debounceMs,
        code: raw
      };
    }

    this.lastCode = raw;
    this.lastTime = currentTime;

    return {
      accepted: true,
      reason: "PROCESSED",
      code: raw,
      timestamp: currentTime
    };
  }

  public getLastScan(): { code: string | null; time: number } {
    return { code: this.lastCode, time: this.lastTime };
  }

  public reset(): void {
    this.lastCode = null;
    this.lastTime = 0;
  }

  public getDebounceMs(): number {
    return this.debounceMs;
  }
}

export const globalScannerDebouncer = new HardwareScannerDebouncer(2500);
