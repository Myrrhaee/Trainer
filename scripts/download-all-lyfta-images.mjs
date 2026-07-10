import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GET_EXERCISES_URL = "https://my.lyfta.app/api/GetExercises";
const LYFTA_IMAGE_BASE_URL = "https://lyfta.app/images/exercises";
const IMAGE_OUTPUT_DIR = "public/exercises/lyfta";
const DATASET_OUTPUT_PATH = "src/data/lyfta-exercises-full.json";

const DEFAULT_LIMIT = Number.parseInt(process.env.LYFTA_PAGE_LIMIT ?? "100", 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.LYFTA_REQUEST_TIMEOUT_MS ?? "30000",
  10
);

const COOKIE_HEADER = process.env.LYFTA_COOKIE?.trim() ?? "";
const PAGINATION_MODE = process.env.LYFTA_PAGINATION_MODE?.trim().toLowerCase() ?? "";

const VALID_PAGINATION_MODES = new Set(["page", "offset"]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const imageOutputDir = path.join(repoRoot, IMAGE_OUTPUT_DIR);
const datasetOutputPath = path.join(repoRoot, DATASET_OUTPUT_PATH);

function assertConfig() {
  if (!Number.isFinite(DEFAULT_LIMIT) || DEFAULT_LIMIT <= 0) {
    throw new Error("LYFTA_PAGE_LIMIT must be a positive integer.");
  }

  if (!Number.isFinite(REQUEST_TIMEOUT_MS) || REQUEST_TIMEOUT_MS <= 0) {
    throw new Error("LYFTA_REQUEST_TIMEOUT_MS must be a positive integer.");
  }

  if (PAGINATION_MODE && !VALID_PAGINATION_MODES.has(PAGINATION_MODE)) {
    throw new Error('LYFTA_PAGINATION_MODE must be either "page" or "offset".');
  }
}

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function buildHeaders() {
  const headers = {
    Accept: "application/json",
  };

  if (COOKIE_HEADER) {
    headers.Cookie = COOKIE_HEADER;
  }

  return headers;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: buildHeaders(),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let json;

    try {
      json = rawText ? JSON.parse(rawText) : null;
    } catch {
      throw new Error(`Expected JSON response from ${url}, received: ${rawText.slice(0, 300)}`);
    }

    if (!response.ok) {
      throw new Error(
        `Request failed with ${response.status} ${response.statusText}: ${rawText.slice(0, 300)}`
      );
    }

    return json;
  } finally {
    clearTimeout(timeout);
  }
}

function getExercisesArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }

  return null;
}

function getPayloadError(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (payload.status === false && typeof payload.message === "string") {
    return payload.message;
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  return null;
}

function buildExercisesUrl(mode, cursorValue) {
  const url = new URL(GET_EXERCISES_URL);

  if (mode === "page") {
    url.searchParams.set("page", String(cursorValue));
    url.searchParams.set("limit", String(DEFAULT_LIMIT));
  } else {
    url.searchParams.set("offset", String(cursorValue));
    url.searchParams.set("limit", String(DEFAULT_LIMIT));
  }

  return url;
}

async function tryFetchExercisesPage(mode, cursorValue) {
  const url = buildExercisesUrl(mode, cursorValue);
  const payload = await fetchJson(url);
  const data = getExercisesArray(payload);
  const payloadError = getPayloadError(payload);

  if (data) {
    return { mode, url: url.toString(), payload, data };
  }

  if (payloadError) {
    throw new Error(`${payloadError} (${url})`);
  }

  throw new Error(`Unsupported response shape from ${url}`);
}

async function fetchExercisesPageWithDetection({
  detectedMode,
  pageNumber,
  offsetValue,
}) {
  if (detectedMode === "page") {
    return tryFetchExercisesPage("page", pageNumber);
  }

  if (detectedMode === "offset") {
    return tryFetchExercisesPage("offset", offsetValue);
  }

  const attempts = [];

  for (const [mode, cursorValue] of [
    ["page", pageNumber],
    ["offset", offsetValue],
  ]) {
    try {
      return await tryFetchExercisesPage(mode, cursorValue);
    } catch (error) {
      attempts.push(`${mode}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Unable to determine LYFTA pagination mode. ${attempts.join(" | ")}`);
}

function getImageUrl(imageName) {
  if (!imageName || typeof imageName !== "string") {
    return null;
  }

  return `${LYFTA_IMAGE_BASE_URL}/${imageName.replace(/^\/+/, "")}`;
}

async function downloadImage(imageUrl, destinationPath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(imageUrl, {
      headers: COOKIE_HEADER ? { Cookie: COOKIE_HEADER } : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Image request failed with ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(destinationPath, buffer);
  } finally {
    clearTimeout(timeout);
  }
}

async function processExerciseImages(exercises) {
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const exercise of exercises) {
    const filePath = path.join(imageOutputDir, `${exercise.id}.png`);

    if (await fileExists(filePath)) {
      skipped += 1;
      continue;
    }

    const imageUrl = getImageUrl(exercise.image_name);

    if (!imageUrl) {
      failed += 1;
      console.error(`  failed: missing image_name for exercise ${exercise.id}`);
      continue;
    }

    try {
      await downloadImage(imageUrl, filePath);
      downloaded += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `  failed: could not download ${imageUrl} for exercise ${exercise.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return { downloaded, skipped, failed };
}

async function saveDataset(exercises) {
  await ensureDir(path.dirname(datasetOutputPath));
  await writeFile(datasetOutputPath, JSON.stringify(exercises, null, 2) + "\n", "utf8");
}

async function main() {
  assertConfig();

  if (!COOKIE_HEADER) {
    console.warn(
      "LYFTA_COOKIE is not set. The GetExercises endpoint currently responds with 'Invalid session' without an authenticated cookie."
    );
  }

  await ensureDir(imageOutputDir);

  const allExercises = [];
  let paginationMode = PAGINATION_MODE || null;
  let page = 1;
  let offset = 0;

  const totals = {
    pages: 0,
    downloaded: 0,
    skipped: 0,
    failed: 0,
  };

  while (true) {
    const result = await fetchExercisesPageWithDetection({
      detectedMode: paginationMode,
      pageNumber: page,
      offsetValue: offset,
    });

    paginationMode = result.mode;
    totals.pages += 1;

    const exercises = result.data;

    console.log(`page: ${paginationMode === "page" ? page : offset / DEFAULT_LIMIT + 1}`);
    console.log(`request: ${result.url}`);
    console.log(`exercises fetched: ${exercises.length}`);

    if (exercises.length === 0) {
      console.log("downloaded images: 0");
      console.log("skipped images: 0");
      console.log("failed images: 0");
      break;
    }

    allExercises.push(...exercises);

    const pageStats = await processExerciseImages(exercises);

    totals.downloaded += pageStats.downloaded;
    totals.skipped += pageStats.skipped;
    totals.failed += pageStats.failed;

    console.log(`downloaded images: ${pageStats.downloaded}`);
    console.log(`skipped images: ${pageStats.skipped}`);
    console.log(`failed images: ${pageStats.failed}`);

    if (paginationMode === "page") {
      page += 1;
    } else {
      offset += DEFAULT_LIMIT;
    }
  }

  await saveDataset(allExercises);

  console.log("");
  console.log("done");
  console.log(`pagination mode: ${paginationMode ?? "unknown"}`);
  console.log(`pages checked: ${totals.pages}`);
  console.log(`total exercises saved: ${allExercises.length}`);
  console.log(`total downloaded images: ${totals.downloaded}`);
  console.log(`total skipped images: ${totals.skipped}`);
  console.log(`total failed images: ${totals.failed}`);
  console.log(`dataset file: ${datasetOutputPath}`);
  console.log(`image directory: ${imageOutputDir}`);
}

main().catch((error) => {
  console.error("");
  console.error("download failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
