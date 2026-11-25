// CI helper. Usage:
//   node scripts/release-prep.mjs version <patch>  -> stamps extension/manifest.json with
//        <major>.<minor>.<patch> (major.minor come from the manifest) and prints it.
//   node scripts/release-prep.mjs updates <version> <xpiUrl> <outFile>
//        -> writes the Firefox update manifest that `update_url` points at.
import { readFileSync, writeFileSync } from "node:fs";

const MANIFEST = "extension/manifest.json";
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const [cmd, ...args] = process.argv.slice(2);

if (cmd === "version") {
  const patch = Number(args[0]);
  if (!Number.isInteger(patch) || patch < 0) throw new Error(`bad patch number: ${args[0]}`);
  const [major = "1", minor = "0"] = manifest.version.split(".");
  manifest.version = `${major}.${minor}.${patch}`;
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(manifest.version);
} else if (cmd === "updates") {
  const [version, link, out] = args;
  const id = manifest.browser_specific_settings.gecko.id;
  const updates = { addons: { [id]: { updates: [{ version, update_link: link }] } } };
  writeFileSync(out, JSON.stringify(updates, null, 2) + "\n");
} else {
  throw new Error(`unknown command: ${cmd}`);
}
