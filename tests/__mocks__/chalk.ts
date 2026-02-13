const identity = (s: string) => s;

const bold = Object.assign(identity, { cyan: identity });

const chalk = {
  blue: identity,
  green: identity,
  red: identity,
  yellow: identity,
  gray: identity,
  cyan: identity,
  bold,
};

export default chalk;
