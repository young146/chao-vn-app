/**
 * Patches the SDK versions in react-native's version catalog.
 * 
 * react-native 0.81.5 ships with libs.versions.toml that sets
 * compileSdk = "36", targetSdk = "36", buildTools = "36.0.0".
 * These may cause issues with current project setup.
 * This script patches SDK values to 35 to match our project config.
 * 
 * NOTE: AGP version is NOT patched because the RN Gradle Plugin's
 * composite build forces AGP 8.11.0 regardless of what we set here.
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
  'compileSdk': '35',
  'targetSdk': '35',
  'buildTools': '35.0.0',
};

try {
  if (!fs.existsSync(TOML_PATH)) {
    console.log('[patch-rn-catalog] libs.versions.toml not found, skipping.');
    process.exit(0);
  }

  let content = fs.readFileSync(TOML_PATH, 'utf8');
  const original = content;

  for (const [key, value] of Object.entries(PATCHES)) {
    const regex = new RegExp(`^${key}\\s*=\\s*"[^"]*"`, 'm');
    content = content.replace(regex, `${key} = "${value}"`);
  }

  if (content === original) {
    console.log('[patch-rn-catalog] All values already patched or patterns not found.');
  } else {
    fs.writeFileSync(TOML_PATH, content, 'utf8');
    console.log('[patch-rn-catalog] ✅ Patched version catalog:');
    for (const [key, value] of Object.entries(PATCHES)) {
      console.log(`  - ${key} = "${value}"`);
    }
  }
} catch (err) {
  console.error('[patch-rn-catalog] Error patching:', err.message);
  process.exit(1);
}
