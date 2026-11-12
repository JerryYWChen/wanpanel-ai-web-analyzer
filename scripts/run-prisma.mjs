import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});

const npmCli = process.env.npm_execpath;

if (!npmCli) {
  throw new Error("Unable to locate the npm CLI for Prisma deployment tasks.");
}

for (const script of ["prisma:generate", "prisma:deploy"]) {
  const result = spawnSync(process.execPath, [npmCli, "run", script], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
