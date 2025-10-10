export const logger = {
  info: (...args) => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  },
  warn: (...args) => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(...args);
    }
  },
  error: (...args) => {
    // eslint-disable-next-line no-console
    console.error(...args);
  },
  debug: (...args) => {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.debug(...args);
    }
  },
};
