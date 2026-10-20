import { describe, it, expect } from "vitest";
import { parseQuestionBlock as p } from "./local-parse";
describe("parseQuestionBlock", () => {
  it("never gives more than 4 options and stops at Ans box", () => {
    const q = p("1", "Q text here\nA. a\nB. b\nC. c\nD. d\nAns\n1. x\n2. y");
    expect(q.options.map((o) => o.label)).toEqual(["A", "B", "C", "D"]);
  });
  it("recovers an option label OCR glued to the question", () => {
    expect(p("1", "Tolerance is equal to ATi\nB.10i\nC.16i\nD.25i").options).toHaveLength(4);
  });
});
