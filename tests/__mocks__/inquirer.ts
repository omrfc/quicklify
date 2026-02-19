class Separator {
  type = "separator";
  line: string;
  constructor(line?: string) {
    this.line = line || "--------";
  }
}

const inquirer = {
  prompt: jest.fn(),
  Separator,
};

export default inquirer;
