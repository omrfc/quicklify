/**
 * Unit tests for risk trend computation and formatting.
 * Tests: computeTrend, formatTrendTerminal, formatTrendJson
 * TREND-01..05 coverage
 */

import { computeTrend } from "../../src/core/audit/history.js";
import {
  formatTrendTerminal,
  formatTrendJson,
} from "../../src/core/audit/formatters/trend.js";
import type { AuditHistoryEntry, TrendResult } from "../../src/core/audit/types.js";
import { stripAnsi } from "../helpers/stripAnsi";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<AuditHistoryEntry> = {}): AuditHistoryEntry {
  return {
    serverIp: "1.2.3.4",
    serverName: "test-server",
    timestamp: "2026-03-10T10:00:00Z",
    overallScore: 70,
    categoryScores: { SSH: 80, Firewall: 60, Updates: 70 },
    ...overrides,
  };
}

// ─── computeTrend ─────────────────────────────────────────────────────────────

describe("computeTrend", () => {
  describe("basic output shape", () => {
    it("returns TrendResult with serverIp, serverName, and entries array", () => {
      const history = [makeEntry()];
      const result = computeTrend(history);
      expect(result.serverIp).toBe("1.2.3.4");
      expect(result.serverName).toBe("test-server");
      expect(Array.isArray(result.entries)).toBe(true);
    });

    it("with 3 entries returns 3 TrendEntry objects", () => {
      const history = [
        makeEntry({ timestamp: "2026-03-08T10:00:00Z", overallScore: 50 }),
        makeEntry({ timestamp: "2026-03-09T10:00:00Z", overallScore: 60 }),
        makeEntry({ timestamp: "2026-03-10T10:00:00Z", overallScore: 70 }),
      ];
      const result = computeTrend(history);
      expect(result.entries).toHaveLength(3);
    });

    it("first entry has delta:null and empty causeList", () => {
      const history = [
        makeEntry({ timestamp: "2026-03-08T10:00:00Z", overallScore: 50 }),
        makeEntry({ timestamp: "2026-03-09T10:00:00Z", overallScore: 60 }),
      ];
      const result = computeTrend(history);
      expect(result.entries[0].delta).toBeNull();
      expect(result.entries[0].causeList).toEqual([]);
    });

    it("subsequent entries have numeric deltas", () => {
      const history = [
        makeEntry({ timestamp: "2026-03-08T10:00:00Z", overallScore: 50 }),
        makeEntry({ timestamp: "2026-03-09T10:00:00Z", overallScore: 60 }),
        makeEntry({ timestamp: "2026-03-10T10:00:00Z", overallScore: 55 }),
      ];
      const result = computeTrend(history);
      expect(result.entries[1].delta).toBe(10);
      expect(result.entries[2].delta).toBe(-5);
    });

    it("entries include score from the source entry", () => {
      const history = [
        makeEntry({ timestamp: "2026-03-08T10:00:00Z", overallScore: 42 }),
      ];
      const result = computeTrend(history);
      expect(result.entries[0].score).toBe(42);
    });

    it("entries include timestamp from the source entry", () => {
      const history = [
        makeEntry({ timestamp: "2026-03-08T10:00:00Z", overallScore: 70 }),
      ];
      const result = computeTrend(history);
      expect(result.entries[0].timestamp).toBe("2026-03-08T10:00:00Z");
    });
  });

  describe("chronological ordering", () => {
    it("sorts entries oldest-first regardless of input order", () => {
      const history = [
        makeEntry({ timestamp: "2026-03-10T10:00:00Z", overallScore: 70 }),
        makeEntry({ timestamp: "2026-03-08T10:00:00Z", overallScore: 50 }),
        makeEntry({ timestamp: "2026-03-09T10:00:00Z", overallScore: 60 }),
      ];
      const result = computeTrend(history);
      expect(result.entries[0].timestamp).toBe("2026-03-08T10:00:00Z");
      expect(result.entries[1].timestamp).toBe("2026-03-09T10:00:00Z");
      expect(result.entries[2].timestamp).toBe("2026-03-10T10:00:00Z");
    });
  });

  describe("causeList (TREND-02)", () => {
    it("causeList includes categories whose score changed between entries", () => {
      const history = [
        makeEntry({
          timestamp: "2026-03-08T10:00:00Z",
          overallScore: 60,
          categoryScores: { SSH: 80, Firewall: 50 },
        }),
        makeEntry({
          timestamp: "2026-03-09T10:00:00Z",
          overallScore: 70,
          categoryScores: { SSH: 80, Firewall: 70 },
        }),
      ];
      const result = computeTrend(history);
      const causes = result.entries[1].causeList;
      expect(causes).toHaveLength(1);
      expect(causes[0].category).toBe("Firewall");
      expect(causes[0].scoreBefore).toBe(50);
      expect(causes[0].scoreAfter).toBe(70);
      expect(causes[0].delta).toBe(20);
    });

    it("causeList excludes categories with no score change", () => {
      const history = [
        makeEntry({
          timestamp: "2026-03-08T10:00:00Z",
          overallScore: 60,
          categoryScores: { SSH: 80, Firewall: 50 },
        }),
        makeEntry({
          timestamp: "2026-03-09T10:00:00Z",
          overallScore: 70,
          categoryScores: { SSH: 80, Firewall: 50 },
        }),
      ];
      const result = computeTrend(history);
      expect(result.entries[1].causeList).toHaveLength(0);
    });

    it("causeList sorts by abs(delta) descending — biggest movers first", () => {
      const history = [
        makeEntry({
          timestamp: "2026-03-08T10:00:00Z",
          overallScore: 60,
          categoryScores: { SSH: 80, Firewall: 50, Updates: 60 },
        }),
        makeEntry({
          timestamp: "2026-03-09T10:00:00Z",
          overallScore: 70,
          categoryScores: { SSH: 85, Firewall: 30, Updates: 65 },
        }),
      ];
      const result = computeTrend(history);
      const causes = result.entries[1].causeList;
      // Firewall: -20, SSH: +5, Updates: +5
      expect(Math.abs(causes[0].delta)).toBeGreaterThanOrEqual(Math.abs(causes[1].delta));
      if (causes.length > 2) {
        expect(Math.abs(causes[1].delta)).toBeGreaterThanOrEqual(Math.abs(causes[2].delta));
      }
    });

    it("handles categories that appear only in before or only in after", () => {
      const history = [
        makeEntry({
          timestamp: "2026-03-08T10:00:00Z",
          categoryScores: { SSH: 80 },
        }),
        makeEntry({
          timestamp: "2026-03-09T10:00:00Z",
          categoryScores: { SSH: 80, Firewall: 60 },
        }),
      ];
      // Should not throw; Firewall was 0 before (or undefined handled as 0)
      expect(() => computeTrend(history)).not.toThrow();
    });
  });

  describe("days filter (TREND-03)", () => {
    it("excludes entries older than N days", () => {
      const now = new Date("2026-03-10T10:00:00Z");
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const history = [
        makeEntry({ timestamp: "2026-03-01T10:00:00Z", overallScore: 40 }), // 9 days ago
        makeEntry({ timestamp: "2026-03-08T10:00:00Z", overallScore: 60 }), // 2 days ago
        makeEntry({ timestamp: "2026-03-10T10:00:00Z", overallScore: 70 }), // today
      ];

      const result = computeTrend(history, { days: 7 });
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].timestamp).toBe("2026-03-08T10:00:00Z");

      jest.useRealTimers();
    });

    it("days filter leaving zero entries returns empty entries array without crashing (TREND-05)", () => {
      const now = new Date("2026-03-10T10:00:00Z");
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const history = [
        makeEntry({ timestamp: "2026-03-01T10:00:00Z", overallScore: 40 }), // 9 days ago
      ];

      const result = computeTrend(history, { days: 3 });
      expect(result.entries).toHaveLength(0);

      jest.useRealTimers();
    });
  });

  describe("edge cases (TREND-05)", () => {
    it("empty history returns TrendResult with empty entries array", () => {
      const result = computeTrend([]);
      expect(result.entries).toHaveLength(0);
      expect(result.serverIp).toBe("");
      expect(result.serverName).toBe("");
    });

    it("single entry returns one TrendEntry with delta:null and empty causeList", () => {
      const history = [makeEntry()];
      const result = computeTrend(history);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].delta).toBeNull();
      expect(result.entries[0].causeList).toEqual([]);
    });
  });
});

// ─── formatTrendTerminal ──────────────────────────────────────────────────────

describe("formatTrendTerminal", () => {
  const sampleResult: TrendResult = {
    serverIp: "1.2.3.4",
    serverName: "test-server",
    entries: [
      {
        timestamp: "2026-03-08T10:00:00Z",
        score: 50,
        delta: null,
        causeList: [],
      },
      {
        timestamp: "2026-03-09T10:00:00Z",
        score: 65,
        delta: 15,
        causeList: [
          { category: "Firewall", scoreBefore: 40, scoreAfter: 70, delta: 30 },
        ],
      },
      {
        timestamp: "2026-03-10T10:00:00Z",
        score: 60,
        delta: -5,
        causeList: [
          { category: "SSH", scoreBefore: 80, scoreAfter: 75, delta: -5 },
        ],
      },
    ],
  };

  it("returns a non-empty string for valid input", () => {
    const output = formatTrendTerminal(sampleResult);
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("contains server name in output", () => {
    const output = stripAnsi(formatTrendTerminal(sampleResult));
    expect(output).toContain("test-server");
  });

  it("contains header line", () => {
    const output = stripAnsi(formatTrendTerminal(sampleResult));
    expect(output).toContain("Kastell Risk Trend");
  });

  it("shows (first) indicator for first entry (delta null)", () => {
    const output = stripAnsi(formatTrendTerminal(sampleResult));
    expect(output).toContain("(first)");
  });

  it("renders positive delta with + prefix", () => {
    const output = stripAnsi(formatTrendTerminal(sampleResult));
    expect(output).toMatch(/\+15/);
  });

  it("renders negative delta with - prefix", () => {
    const output = stripAnsi(formatTrendTerminal(sampleResult));
    expect(output).toMatch(/-5/);
  });

  it("shows cause lines under entries with causeList", () => {
    const output = stripAnsi(formatTrendTerminal(sampleResult));
    expect(output).toContain("Firewall");
    expect(output).toContain("SSH");
  });

  it("shows cause line format with before -> after", () => {
    const output = stripAnsi(formatTrendTerminal(sampleResult));
    expect(output).toContain("40 -> 70");
  });

  it("shows No audit history message when entries are empty", () => {
    const emptyResult: TrendResult = {
      serverIp: "1.2.3.4",
      serverName: "test-server",
      entries: [],
    };
    const output = stripAnsi(formatTrendTerminal(emptyResult));
    expect(output.toLowerCase()).toContain("no audit history");
  });

  it("includes score values in output", () => {
    const output = stripAnsi(formatTrendTerminal(sampleResult));
    expect(output).toContain("50");
    expect(output).toContain("65");
  });
});

// ─── formatTrendJson ──────────────────────────────────────────────────────────

describe("formatTrendJson", () => {
  const sampleResult: TrendResult = {
    serverIp: "1.2.3.4",
    serverName: "test-server",
    entries: [
      {
        timestamp: "2026-03-08T10:00:00Z",
        score: 50,
        delta: null,
        causeList: [],
      },
      {
        timestamp: "2026-03-09T10:00:00Z",
        score: 70,
        delta: 20,
        causeList: [
          { category: "Firewall", scoreBefore: 40, scoreAfter: 80, delta: 40 },
        ],
      },
    ],
  };

  it("returns a valid JSON string (TREND-04)", () => {
    const json = formatTrendJson(sampleResult);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("parsed JSON matches TrendResult structure", () => {
    const json = formatTrendJson(sampleResult);
    const parsed = JSON.parse(json) as TrendResult;
    expect(parsed.serverIp).toBe("1.2.3.4");
    expect(parsed.serverName).toBe("test-server");
    expect(Array.isArray(parsed.entries)).toBe(true);
    expect(parsed.entries).toHaveLength(2);
  });

  it("preserves delta:null in JSON", () => {
    const json = formatTrendJson(sampleResult);
    const parsed = JSON.parse(json) as TrendResult;
    expect(parsed.entries[0].delta).toBeNull();
  });

  it("preserves causeList entries in JSON", () => {
    const json = formatTrendJson(sampleResult);
    const parsed = JSON.parse(json) as TrendResult;
    expect(parsed.entries[1].causeList).toHaveLength(1);
    expect(parsed.entries[1].causeList[0].category).toBe("Firewall");
  });

  it("with empty entries returns valid JSON with empty entries array", () => {
    const emptyResult: TrendResult = {
      serverIp: "1.2.3.4",
      serverName: "test-server",
      entries: [],
    };
    const json = formatTrendJson(emptyResult);
    const parsed = JSON.parse(json) as TrendResult;
    expect(parsed.entries).toHaveLength(0);
  });
});
