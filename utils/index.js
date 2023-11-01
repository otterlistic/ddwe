/**
 *
 * @param {number} ms - milliseconds
 * @returns Promise
 */
export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
