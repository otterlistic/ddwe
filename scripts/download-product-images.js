import sharp from "sharp";
import path from "path";
import sqlite3 from "sqlite3";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { sleep } from "../utils/index.js";
import { ApiError } from "../utils/api-error.js";

const db = new sqlite3.Database("./data/main.db");

async function makeProductDirectory(filePath) {
  const [dirName, _imageName] = filePath.split("/");
  try {
    await mkdir(path.resolve("../deduper/images", dirName));
  } catch (error) {
    if (error.code === "EEXIST") {
      console.warn(
        `[Warn]: Directory ${dirName} exists, an error was thrown but has been silently ignored.`
      );
      // this is fine, the folder exists so we ignore
      return;
    }
    console.error(
      `[Error]: An error occured while attempting to make ${dirName} directory:\n${error.message}`
    );
  }
}

async function downloadProductImage(productId, imageId) {
  try {
    const url = `https://fbpprod.fts.at/api/v1/sht/articles/${productId}/media/${imageId}`;
    const filePath = `${productId}/${imageId}.jpg`;
    await makeProductDirectory(filePath);
    const destination = path.resolve("../deduper/images", filePath);
    const fileStream = createWriteStream(destination, { flags: "wx" });
    const res = await fetch(url);
    if (
      res.headers.has("Content-Type") &&
      // if the image is not a jpeg, convert it to jpeg
      !res.headers.get("Content-Type").toLowerCase().includes("image/jpeg")
    ) {
      const buffer = await res.arrayBuffer();
      await sharp(buffer).jpeg({ mozjpeg: true }).pipe(fileStream);
    } else {
      await finished(Readable.fromWeb(res.body).pipe(fileStream));
    }
  } catch (error) {
    if (error.code === "EEXISTS") {
      console.warn(
        `[Warn]: Path conflict found on ${filePath}, an error was thrown but has been silently ignored.`
      );
      return;
    }
    console.error(
      `[Error]: An error occured while trying to download ${filePath}:\n${error.message}`
    );
  }
}

export async function downloadProductImages() {
  db.serialize(() => {
    db.all(
      "SELECT product_id FROM products WHERE image_id IS NOT NULL",
      async (err, rows) => {
        if (err) {
          console.error(
            `[Error]: Failed to get products from db because of the following error:\n${err.message}`
          );
        }
        const productCount = rows.length;
        const productIdList = rows.map((row) => row?.product_id);
        console.info(`[Info]: Fetched ${productCount} product ids.`);
        const BATCH_LIMIT = 1;
        for (
          let BATCH_COUNTER = 0;
          BATCH_COUNTER < productCount;
          BATCH_COUNTER += BATCH_LIMIT
        ) {
          const productId = productIdList[BATCH_COUNTER];
          const res = await fetch(
            `https://fbpprod.fts.at/api/v1/sht/articles/${productId}`
          );

          if (
            res.headers.has("Content-Type") &&
            res.headers
              .get("Content-Type")
              .toLowerCase()
              .includes("application/json")
          ) {
            const json = await res.json();
            if (res.ok) {
              const imageIdList = json?.imageIds;

              if (imageIdList.length > 0) {
                db.run(
                  `UPDATE products SET image_ids = $imageIds WHERE product_id = $productId`,
                  {
                    $imageIds: JSON.stringify(imageIdList),
                    $productId: productId,
                  }
                );
                console.info(
                  `[Info]: Saved ${JSON.stringify(
                    imageIdList
                  )} image IDs of ${productId} to db`
                );
                const promises = imageIdList.map((imageId) => {
                  return downloadProductImage(productId, imageId);
                });
                await Promise.all(promises);
                console.info(
                  `[Info]: Finished downloading images for ${productId}`
                );
              }
            } else {
              console.error(
                `[Error]: An error occured while attempting to download images for ${productId}:\n${json}`
              );
            }
          }
          await sleep(5000);
        }
      }
    );
  });
}
