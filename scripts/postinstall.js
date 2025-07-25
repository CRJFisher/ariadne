#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { pipeline } = require('stream/promises');
const tar = require('tar');

const GITHUB_REPO = 'CRJFisher/ast-climber';
const PLATFORM = process.platform;
const ARCH = process.arch;

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }
    }).on('error', reject);
  });
}

async function getLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      headers: {
        'User-Agent': 'ast-climber-installer'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function downloadPrebuilds() {
  try {
    console.log('Checking for prebuilt binaries...');

    const release = await getLatestRelease();
    const assetName = `prebuilds-${PLATFORM}-${ARCH}.tar.gz`;
    const asset = release.assets.find(a => a.name === assetName);

    if (!asset) {
      console.log(`No prebuilt binaries found for ${PLATFORM}-${ARCH}, building from source...`);
      return false;
    }

    const tempFile = path.join(__dirname, '..', 'prebuilds.tar.gz');
    console.log(`Downloading prebuilt binaries from ${asset.browser_download_url}...`);

    await downloadFile(asset.browser_download_url, tempFile);

    console.log('Extracting prebuilt binaries...');
    await tar.x({
      file: tempFile,
      cwd: path.join(__dirname, '..')
    });

    // Copy the .node files to their respective locations
    const prebuildsDir = path.join(__dirname, '..', 'prebuilds', `${PLATFORM}-${ARCH}`);
    const nodeModulesDir = path.join(__dirname, '..', 'node_modules');

    const modules = fs.readdirSync(prebuildsDir);
    for (const module of modules) {
      const modulePrebuiltDir = path.join(prebuildsDir, module);
      const moduleTargetDir = path.join(nodeModulesDir, module, 'build', 'Release');

      if (fs.existsSync(modulePrebuiltDir)) {
        fs.mkdirSync(moduleTargetDir, { recursive: true });
        const files = fs.readdirSync(modulePrebuiltDir);

        for (const file of files) {
          if (file.endsWith('.node')) {
            const src = path.join(modulePrebuiltDir, file);
            const dest = path.join(moduleTargetDir, file);
            fs.copyFileSync(src, dest);
            console.log(`Installed ${module}/${file}`);
          }
        }
      }
    }

    // Clean up
    fs.unlinkSync(tempFile);
    fs.rmSync(path.join(__dirname, '..', 'prebuilds'), { recursive: true, force: true });

    console.log('Prebuilt binaries installed successfully!');
    return true;
  } catch (error) {
    console.error('Error downloading prebuilds:', error.message);
    return false;
  }
}

async function main() {
  // Scenario 2: CI is running tests.
  // Let the standard `npm ci` handle the from-source compilation. Do nothing here.
  if (process.env.CI) {
    console.log('CI environment detected. Skipping postinstall script.');
    return;
  }

  // Scenario 1: A developer is working on this repo.
  // We detect this by checking for the existence of the .git directory.
  // In this case, we MUST build from source to test local changes.
  const isDevEnvironment = fs.existsSync(path.join(__dirname, '..', '.git'));
  if (isDevEnvironment) {
    console.log('Developer environment detected. Building from source...');
    try {
      execSync('npm rebuild', { stdio: 'inherit' });
      console.log('Successfully built from source.');
    } catch (error) {
      console.error('Failed to build from source in dev environment:', error.message);
      process.exit(1);
    }
    return;
  }

  // Scenario 3: A 3rd party user is installing our library.
  // Only in this case should we attempt to download pre-built binaries.
  console.log('Installing as a dependency. Attempting to download pre-built binaries...');
  const success = await downloadPrebuilds();

  if (!success) {
    // Fallback for the end-user if pre-built binaries are not available for their platform.
    console.log('Could not download pre-built binaries. Falling back to building from source...');
    try {
      execSync('npm rebuild', { stdio: 'inherit' });
    } catch (error) {
      console.error('Failed to build from source:', error.message);
      process.exit(1);
    }
  }
}

// Only run if this is the main module
if (require.main === module) {
  main().catch(console.error);
}