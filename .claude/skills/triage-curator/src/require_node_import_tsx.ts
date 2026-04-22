/**
 * Side-effect module: abort if invoked via the tsx CLI (pnpm exec tsx / npx tsx).
 *
 * Scripts must run under `node --import tsx <script>` so that child process
 * spawning and stdio behaviour match the rest of the self-repair tooling.
 */

if (process.env.TSX_CWD !== undefined) {
  process.stderr.write(
    "Error: do not invoke with tsx CLI (pnpm exec tsx / npx tsx) — use node --import tsx:\n",
  );
  process.stderr.write(
    `  node --import tsx ${process.argv[1]} ${process.argv.slice(2).join(" ")}\n`,
  );
  process.exit(1);
}
