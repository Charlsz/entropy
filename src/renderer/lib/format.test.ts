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
