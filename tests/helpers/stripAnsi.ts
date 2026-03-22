// eslint-disable-next-line no-control-regex
export function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-9;]*m/g, "");
}
