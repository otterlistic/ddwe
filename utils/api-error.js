export class ApiError extends Error {
  /**
   * @param {String} message
   * @param {String} code
   */
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}
