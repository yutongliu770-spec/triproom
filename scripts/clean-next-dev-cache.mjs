import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const nextCacheUrl = new URL("../.next", import.meta.url);

rmSync(nextCacheUrl, { force: true, recursive: true });
rmSync(new URL("../node_modules/.cache/next", import.meta.url), { force: true, recursive: true });
rmSync(join(tmpdir(), "next-swc"), { force: true, recursive: true });
