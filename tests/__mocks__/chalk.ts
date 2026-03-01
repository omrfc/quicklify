const identity = (s: string) => s;

function chainable(): typeof identity & Record<string, typeof identity> {
  const fn = Object.assign(identity, {}) as typeof identity & Record<string, typeof identity>;
  return new Proxy(fn, {
    get(_target, prop) {
      if (prop === "call" || prop === "apply" || prop === "bind") return (fn as never)[prop as keyof typeof fn];
      return chainable();
    },
  });
}

const chalk = chainable();

export default chalk;
