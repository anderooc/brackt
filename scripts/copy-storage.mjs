#!/usr/bin/env node

/*
 * Copies every Storage object from one Supabase project to another, keeping
 * the same bucket ids and object paths. Safe to re-run: uploads use upsert.
 *
 *   OLD_SUPABASE_URL=... OLD_SERVICE_ROLE_KEY=... \
 *   NEW_SUPABASE_URL=... NEW_SERVICE_ROLE_KEY=... \
 *   node scripts/copy-storage.mjs [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;
const CONCURRENCY = 4;
const dryRun = process.argv.includes("--dry-run");

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}.`);
    process.exit(1);
  }
  return value;
}

function serviceClient(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const oldUrl = requireEnv("OLD_SUPABASE_URL");
const newUrl = requireEnv("NEW_SUPABASE_URL");
if (oldUrl === newUrl) {
  console.error("OLD_SUPABASE_URL and NEW_SUPABASE_URL are the same project.");
  process.exit(1);
}

const source = serviceClient(oldUrl, requireEnv("OLD_SERVICE_ROLE_KEY"));
const target = serviceClient(newUrl, requireEnv("NEW_SERVICE_ROLE_KEY"));

/** Storage `list` is one folder deep; folders come back with a null id. */
async function listFilesRecursive(bucketId, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await source.storage
      .from(bucketId)
      .list(prefix, { limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${bucketId}/${prefix}: ${error.message}`);

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        files.push(...(await listFilesRecursive(bucketId, path)));
      } else if (item.name !== ".emptyFolderPlaceholder") {
        files.push({ path, metadata: item.metadata ?? {} });
      }
    }
    if (data.length < PAGE_SIZE) break;
  }
  return files;
}

async function ensureTargetBucket(bucket) {
  const { data: existing } = await target.storage.getBucket(bucket.id);
  if (existing) return;

  console.log(`  creating bucket ${bucket.id} in target`);
  if (dryRun) return;
  const { error } = await target.storage.createBucket(bucket.id, {
    public: bucket.public,
    fileSizeLimit: bucket.file_size_limit ?? undefined,
    allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
  });
  if (error) throw new Error(`create bucket ${bucket.id}: ${error.message}`);
}

async function copyFile(bucketId, file) {
  const { data: blob, error: downloadError } = await source.storage
    .from(bucketId)
    .download(file.path);
  if (downloadError) throw new Error(`download: ${downloadError.message}`);

  const cacheControl = /max-age=(\d+)/.exec(file.metadata.cacheControl ?? "")?.[1];
  const { error: uploadError } = await target.storage
    .from(bucketId)
    .upload(file.path, blob, {
      upsert: true,
      contentType: file.metadata.mimetype ?? blob.type ?? undefined,
      ...(cacheControl ? { cacheControl } : {}),
    });
  if (uploadError) throw new Error(`upload: ${uploadError.message}`);
}

async function copyBucket(bucket) {
  console.log(`\nBucket ${bucket.id} (${bucket.public ? "public" : "private"})`);
  await ensureTargetBucket(bucket);

  const files = await listFilesRecursive(bucket.id);
  console.log(`  ${files.length} file(s)`);
  if (dryRun) {
    for (const file of files) console.log(`  would copy ${file.path}`);
    return { copied: 0, failed: [] };
  }

  let copied = 0;
  const failed = [];
  let next = 0;
  async function worker() {
    while (next < files.length) {
      const file = files[next++];
      try {
        await copyFile(bucket.id, file);
        copied++;
        if (copied % 25 === 0 || copied === files.length) {
          console.log(`  ${copied}/${files.length}`);
        }
      } catch (error) {
        failed.push({ path: file.path, message: error.message });
        console.error(`  FAILED ${file.path}: ${error.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { copied, failed };
}

const { data: buckets, error } = await source.storage.listBuckets();
if (error) {
  console.error(`Could not list source buckets: ${error.message}`);
  process.exit(1);
}

console.log(`${dryRun ? "[dry run] " : ""}Copying ${buckets.length} bucket(s)`);
console.log(`  from ${oldUrl}`);
console.log(`  to   ${newUrl}`);

const allFailures = [];
for (const bucket of buckets) {
  const { failed } = await copyBucket(bucket);
  allFailures.push(...failed.map((f) => ({ bucket: bucket.id, ...f })));
}

if (allFailures.length > 0) {
  console.error(`\n${allFailures.length} file(s) failed. Re-run to retry them:`);
  for (const f of allFailures) console.error(`  ${f.bucket}/${f.path}: ${f.message}`);
  process.exit(1);
}
console.log("\nDone.");
