import { describe, expect, it } from "vitest";
import { formatBytes, formatSimilarConsumption } from "./format";

describe("similar file consumption", () => {
  it("shows zero when there are no extra copies", () => {
    expect(formatSimilarConsumption(0)).toBe("0 B");
    expect(formatSimilarConsumption(0)).not.toBe(formatBytes(4096));
  });

  it("formats a real duplicate total and a pending measurement", () => {
    expect(formatSimilarConsumption(2048)).toBe("2.0 KB");
    expect(formatSimilarConsumption(null)).toBe("…");
  });
});

describe("formatBytes", () => {
  it("steps through KB / MB / GB / TB without overflowing into a huge GB label", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
    expect(formatBytes(2 * 1024 * 1024 * 1024 * 1024)).toBe("2.0 TB");
  });

  it("does not invent a size for invalid measurements", () => {
    expect(formatBytes(Number.NaN)).toBe("—");
    expect(formatBytes(-4)).toBe("—");
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
