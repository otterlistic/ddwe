import { downloadProductImages } from "./scripts/download-product-images.js";

async function main() {
  try {
    await downloadProductImages();
  } catch (error) {
    throw error;
  }
}

try {
  console.info(`[Script Initialized]: Started at ${Date.now()}`);
  await main();
} catch (error) {
  console.error(`[Error Occured]: ${error.message}`);
} finally {
  console.info(`[Script Terminated]: Finished at ${Date.now()}`);
}
