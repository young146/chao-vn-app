/**
 * Patches the AGP version in react-native's version catalog.
 * 
 * react-native 0.81.5 ships with libs.versions.toml that sets agp = "8.11.0"
 * This causes "No matching variant" errors for all RN native modules on EAS Build.
 * This script patches it to 8.7.3 which is compatible with the current setup.
 * 
 * Runs automatically via npm postinstall hook.
 */
const fs = require('fs');
const path = require('path');

const TOML_PATH = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native',
  'gradle',
  'libs.versions.toml'
);

const TARGET_AGP = '8.7.3';

try {
  if (!fs.existsSync(TOML_PATH)) {
    console.log('[patch-agp] libs.versions.toml not found, skipping.');
    process.exit(0);
  }

  let content = fs.readFileSync(TOML_PATH, 'utf8');
  const original = content;

  // Replace agp version
  content = content.replace(/^agp\s*=\s*"[^"]*"/m, `agp = "${TARGET_AGP}"`);

  if (content === original) {
    console.log(`[patch-agp] AGP already set to ${TARGET_AGP} or pattern not found.`);
  } else {
    fs.writeFileSync(TOML_PATH, content, 'utf8');
    console.log(`[patch-agp] ✅ Patched AGP version to ${TARGET_AGP}`);
  }
} catch (err) {
  console.error('[patch-agp] Error patching AGP:', err.message);
  process.exit(1);
}
