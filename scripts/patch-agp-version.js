/**
 * Patches the AGP version and SDK versions in react-native's version catalog.
 * 
 * react-native 0.81.5 ships with libs.versions.toml that sets agp = "8.11.0",
 * compileSdk = "36", targetSdk = "36", buildTools = "36.0.0".
 * These cause "No matching variant" errors for all RN native modules on EAS Build.
 * This script patches them to compatible values.
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

const PATCHES = {
  'agp': '8.7.3',
  'compileSdk': '35',
  'targetSdk': '35',
  'buildTools': '35.0.0',
};

try {
  if (!fs.existsSync(TOML_PATH)) {
    console.log('[patch-agp] libs.versions.toml not found, skipping.');
    process.exit(0);
  }

  let content = fs.readFileSync(TOML_PATH, 'utf8');
  const original = content;

  for (const [key, value] of Object.entries(PATCHES)) {
    const regex = new RegExp(`^${key}\\s*=\\s*"[^"]*"`, 'm');
    content = content.replace(regex, `${key} = "${value}"`);
  }

  if (content === original) {
    console.log('[patch-agp] All values already patched or patterns not found.');
  } else {
    fs.writeFileSync(TOML_PATH, content, 'utf8');
    console.log('[patch-agp] ✅ Patched version catalog:');
    for (const [key, value] of Object.entries(PATCHES)) {
      console.log(`  - ${key} = "${value}"`);
    }
  }
} catch (err) {
  console.error('[patch-agp] Error patching:', err.message);
  process.exit(1);
}
