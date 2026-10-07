import "dotenv/config";
import express from "express";

const app = express();

const PORT = Number(process.env.PORT ?? 3005);
const VIETQR_HOST = process.env.VIETQR_HOST ?? "https://api.vietqr.io";

console.log(`VIETQR_HOST=${VIETQR_HOST}`);
console.log(`PORT=${PORT}`);

function readRequestBody(req: express.Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      chunks.push(Buffer.from(chunk));
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);
  });
}

app.use("/api/vietqr", async (req, res) => {
  const startedAt = Date.now();

  try {
    const targetPath = req.originalUrl.replace(/^\/api\/vietqr/, "");

    const targetUrl = `${VIETQR_HOST}${targetPath}`;

    console.log(`[VietQR] ${req.method} ${req.originalUrl} -> ${targetUrl}`);

    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) {
        continue;
      }

      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    // Let fetch calculate the request framing.
    headers.delete("host");
    headers.delete("content-length");
    headers.delete("transfer-encoding");
    headers.delete("connection");

    const body =
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : await readRequestBody(req);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      // @ts-ignore
      body,
    });

    console.log(
      `[VietQR] ${req.method} ${targetPath} -> ${response.status} (${Date.now() - startedAt}ms)`,
    );

    res.status(response.status);

    response.headers.forEach((value, key) => {
      if (
        key !== "content-encoding" &&
        key !== "content-length" &&
        key !== "transfer-encoding"
      ) {
        res.setHeader(key, value);
      }
    });

    const responseBody = Buffer.from(await response.arrayBuffer());

    res.send(responseBody);
  } catch (error) {
    console.error(
      `[VietQR] ${req.method} ${req.originalUrl} failed (${Date.now() - startedAt}ms)`,
      error,
    );

    if (!res.headersSent) {
      res.status(502).json({
        message: "Payment provider request failed",
      });
    }
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`HR Payment Proxy listening on :${PORT}`);
});
