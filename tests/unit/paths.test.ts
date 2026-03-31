import { KASTELL_DIR } from "../../src/utils/paths.js";
import { homedir } from "os";
import { join } from "path";

describe("paths", () => {
  it("KASTELL_DIR equals join(homedir(), '.kastell')", () => {
    expect(KASTELL_DIR).toBe(join(homedir(), ".kastell"));
  });
});
