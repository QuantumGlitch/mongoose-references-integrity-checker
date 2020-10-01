module.exports = class RefConstraintError extends Error {
  constructor(options) {
    super();
    this.options = options;
  }
};
