const createMockSpinner = () => {
  const spinner: any = {
    text: "",
    color: "cyan",
  };
  spinner.start = jest.fn(() => spinner);
  spinner.succeed = jest.fn(() => spinner);
  spinner.fail = jest.fn(() => spinner);
  spinner.warn = jest.fn(() => spinner);
  spinner.stop = jest.fn(() => spinner);
  return spinner;
};

const ora = jest.fn(() => createMockSpinner());

export default ora;
export { createMockSpinner };
