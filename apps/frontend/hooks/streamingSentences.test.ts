import { describe, it, expect } from "vitest";
import { segmentSentences } from "./streamingSentences";

/** The sentences that are safe to announce from a buffer. */
function completed(buffer: string): string[] {
  return segmentSentences(buffer).sentences;
}

describe("segmentSentences", () => {
  it("returns nothing while the first sentence is still being written", () => {
    expect(completed("I have checked the esc")).toEqual([]);
    expect(segmentSentences("I have checked the esc").rest).toBe(
      "I have checked the esc"
    );
  });

  it("emits a sentence once its terminating punctuation arrives", () => {
    expect(completed("Order approved. ")).toEqual(["Order approved."]);
  });

  it("keeps the unterminated tail in rest", () => {
    const result = segmentSentences("Order approved. Now I am fetching");
    expect(result.sentences).toEqual(["Order approved."]);
    expect(result.rest).toBe("Now I am fetching");
  });

  it("splits several completed sentences in order", () => {
    const result = segmentSentences("Order approved. Escrow released. Done!");
    expect(result.sentences).toEqual([
      "Order approved.",
      "Escrow released.",
      "Done!",
    ]);
    expect(result.rest).toBe("");
  });

  it("handles question and exclamation marks", () => {
    expect(completed("Should I proceed? Yes! Go.")).toEqual([
      "Should I proceed?",
      "Yes!",
      "Go.",
    ]);
  });

  it("treats a run of terminators as a single boundary", () => {
    expect(completed("Wait... Really?! Yes.")).toEqual([
      "Wait...",
      "Really?!",
      "Yes.",
    ]);
  });

  it("handles the single-character ellipsis", () => {
    expect(completed("Hmm… alright.")).toEqual(["Hmm…", "alright."]);
  });

  it("does not split on a decimal", () => {
    const result = segmentSentences("The total is 3.5 XLM today.");
    expect(result.sentences).toEqual(["The total is 3.5 XLM today."]);
  });

  it("does not split on a known abbreviation", () => {
    expect(completed("Dr. Chen approved the order.")).toEqual([
      "Dr. Chen approved the order.",
    ]);
    expect(completed("Order placed by Acme Inc. yesterday.")).toEqual([
      "Order placed by Acme Inc. yesterday.",
    ]);
  });

  it("does not split on initials", () => {
    expect(completed("J. R. Doyle confirmed it.")).toEqual([
      "J. R. Doyle confirmed it.",
    ]);
  });

  it("keeps trailing quotes and brackets with their sentence", () => {
    expect(completed('He said "approved". Next.')).toEqual([
      'He said "approved".',
      "Next.",
    ]);
  });

  it("withholds a boundary when the following word is lowercase", () => {
    // "…declined. try again" is ambiguous — the period is more likely mid-clause
    // than a sentence end, so nothing is emitted and `flush` handles the tail.
    const result = segmentSentences("Payment declined. try again later");
    expect(result.sentences).toEqual([]);
    expect(result.rest).toBe("Payment declined. try again later");
  });

  it("withholds a boundary on a mid-clause decimal", () => {
    const result = segmentSentences("Signed at 3.5 pm and dispatched");
    expect(result.sentences).toEqual([]);
    expect(result.rest).toBe("Signed at 3.5 pm and dispatched");
  });

  it("uses a newline as a hard boundary", () => {
    const result = segmentSentences("Escrow released\nOrder confirmed");
    expect(result.sentences).toEqual(["Escrow released"]);
    expect(result.rest).toBe("Order confirmed");
  });

  it("force-splits a run-on with no punctuation so it still gets spoken", () => {
    const runOn = "word ".repeat(200).trim();
    const result = segmentSentences(runOn);
    expect(result.sentences.length).toBeGreaterThan(1);
    for (const sentence of result.sentences) {
      expect(sentence.length).toBeLessThanOrEqual(320);
    }
    // Nothing is lost or duplicated when the chunks are rejoined, including
    // the shorter remainder that stays buffered.
    const rejoined = result.sentences.join(" ");
    expect(result.rest ? `${rejoined} ${result.rest}` : rejoined).toBe(runOn);
  });

  it("ignores whitespace-only and empty buffers", () => {
    expect(completed("")).toEqual([]);
    expect(completed("   \n  ")).toEqual([]);
    expect(segmentSentences("   \n  ").rest).toBe("");
  });

  it("is incremental: feeding the growing buffer never re-emits old sentences", () => {
    // Mirrors how the hook calls it on every token.
    const stream = "Order approved. Escrow released. Shipping now";
    let rest = "";
    const emitted: string[] = [];
    for (const char of stream) {
      const result = segmentSentences(rest + char);
      emitted.push(...result.sentences);
      rest = result.rest;
    }
    expect(emitted).toEqual(["Order approved.", "Escrow released."]);
    expect(rest).toBe("Shipping now");
  });
});
