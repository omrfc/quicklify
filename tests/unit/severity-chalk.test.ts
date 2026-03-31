import { severityChalk } from "../../src/core/audit/formatters/shared.js";
import chalk from "chalk";

describe("severityChalk", () => {
  it("returns chalk.red for critical", () => {
    expect(severityChalk("critical")).toBe(chalk.red);
  });
  it("returns chalk.yellow for warning", () => {
    expect(severityChalk("warning")).toBe(chalk.yellow);
  });
  it("returns chalk.blue for info", () => {
    expect(severityChalk("info")).toBe(chalk.blue);
  });
});
