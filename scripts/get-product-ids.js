import { sleep } from "../utils/index.js";
import { ApiError } from "../utils/api-error.js";
import sqlite3 from "sqlite3";
const db = new sqlite3.Database("./data/main.db");

export async function generateProductIdCollection() {
  try {
    const totalProductsCount = await getTotalProductsCount();
    const BATCH_LIMIT = 100;
    console.info(`[Info]: Started fetching ${totalProductsCount} products.`);
    for (
      let BATCH_OFFSET = 0;
      BATCH_OFFSET < totalProductsCount;
      BATCH_OFFSET += BATCH_LIMIT
    ) {
      const FROM = BATCH_OFFSET;
      const TO = BATCH_LIMIT + BATCH_OFFSET;
      const res = await fetch(
        `https://fbpprod.fts.at/api/v1/sht/articles/search?limit=${BATCH_LIMIT}&offset=${BATCH_OFFSET}&orderBy=relevance&orderDir=desc`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            search: "",
            attributes: [],
            includeSubcategories: true,
          }),
        }
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
          const productBatch = json?.articles;
          db.serialize(() => {
            const productInsertQuery = `INSERT INTO products (product_id, thumbnail_id) VALUES (?, ?)`;
            const statement = db.prepare(productInsertQuery);
            productBatch.forEach((product) => {
              statement.run([product.id, product.imageId], (error) => {
                if (error) {
                  console.error(
                    `[Error]: An error occured while attempting to insert products from ${FROM} to ${TO}:\n${error.message}`
                  );
                }
              });
            });
            statement.finalize();
          });

          console.log(
            `[Info]: Fetched from ${FROM} to ${TO} and received ${productBatch.length} products`
          );
        } else {
          console.error(
            `[Error]: Server responded with ${
              res.status
            } while fetching from ${FROM} to ${TO}:\n${JSON.stringify(json)}`
          );
        }
      }

      await sleep(5000);
    }

    console.info(`[Info]: Finished fetching ${totalProductsCount} products.`);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "fetch/total-fail") {
        console.log(`Terminating process due to the error: ${error.message}`);
        process.abort();
      }
    }
    throw error;
  } finally {
    db.close();
  }
}

async function getTotalProductsCount() {
  const res = await fetch(
    `https://fbpprod.fts.at/api/v1/sht/articles/search?limit=1&offset=0&orderBy=relevance&orderDir=desc`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  if (
    res.ok &&
    res.headers.has("Content-Type") &&
    res.headers.get("Content-Type").toLowerCase().includes("application/json")
  ) {
    const json = await res.json();
    const total = json.total;
    console.info(
      `[Info]: Determined ${total} products exist, beginning fetch now.`
    );
    return total;
  }
  console.error(await res.text());
  const error = new ApiError(
    `Couldn't fetch total number of products.`,
    "fetch/total-fail"
  );
  throw error;
}
