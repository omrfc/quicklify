import { serverExplainHandler, serverExplainSchema } from "../../src/mcp/tools/serverExplain.js";

describe("serverExplainHandler", () => {
  it("returns check details for valid ID", async () => {
    const result = await serverExplainHandler({ checkId: "SSH-PASSWORD-AUTH" });
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.id).toBe("SSH-PASSWORD-AUTH");
    expect(parsed.category).toBe("SSH");
    expect(parsed.severity).toBe("critical");
    expect(parsed.explain).toBeDefined();
    expect(parsed.complianceRefs).toBeInstanceOf(Array);
  });

  it("returns error for unknown ID with suggestions", async () => {
    const result = await serverExplainHandler({ checkId: "SSH-PASWORD-AUTH" });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBeDefined();
    expect(parsed.suggestions).toContain("SSH-PASSWORD-AUTH");
  });

  it("returns error for completely unknown ID", async () => {
    const result = await serverExplainHandler({ checkId: "ZZZZZ-999" });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBeDefined();
    expect(parsed.suggestions).toEqual([]);
  });
});

describe("serverExplainSchema", () => {
  it("requires checkId string", () => {
    const result = serverExplainSchema.safeParse({ checkId: "SSH-PASSWORD-AUTH" });
    expect(result.success).toBe(true);
  });

  it("rejects missing checkId", () => {
    const result = serverExplainSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
