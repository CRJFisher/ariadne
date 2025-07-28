#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const tar = require('tar');

const GITHUB_REPO = 'CRJFisher/ariadne';
const PLATFORM = process.platform;
const ARCH = process.arch;

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        const redirectReq = https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        });
        redirectReq.on('error', reject);
        redirectReq.setTimeout(30000); // 30 second timeout for downloads
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      file.close();
      reject(new Error('Download timed out'));
    });
    req.setTimeout(30000); // 30 second timeout
  });
}

async function getLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      headers: {
        'User-Agent': 'ariadne-installer'
      }
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // Check if we got an error response (e.g., 404 for no releases)
          if (parsed.message && (parsed.message.includes('Not Found') || parsed.message.includes('no releases'))) {
            console.log('No releases found on GitHub.');
            resolve(null);
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.setTimeout(10000); // 10 second timeout
  });
}

async function downloadPrebuilds() {
  try {
    console.log('Checking for prebuilt binaries...');

    const release = await getLatestRelease();

    // Check if release exists and has assets
    if (!release) {
      console.log('No releases available yet.');
      return false;
    }

    if (!release.assets || !Array.isArray(release.assets)) {
      console.log('Release found but no assets available.');
      return false;
    }

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
  // Allow skipping postinstall with environment variable
  if (process.env.SKIP_POSTINSTALL) {
    console.log('SKIP_POSTINSTALL set. Skipping postinstall script.');
    return;
  }

  // Scenario 2: CI is running tests.
  // Let the standard `npm ci` handle the from-source compilation. Do nothing here.
  if (process.env.CI) {
    console.log('CI environment detected. Skipping postinstall script.');
    return;
  }

  // Scenario 1: A developer is working on this repo.
  // We detect this by checking for the existence of the .git directory.
  // In a monorepo, check both the package directory and parent directories.
  const checkPaths = [
    path.join(__dirname, '..', '.git'),           // Package directory
    path.join(__dirname, '..', '..', '.git'),     // Workspace root
    path.join(__dirname, '..', '..', '..', '.git') // Parent of workspace
  ];

  const isDevEnvironment = checkPaths.some(p => fs.existsSync(p));
  if (isDevEnvironment) {
    console.log('Developer environment detected. Building from source...');
    try {
      // Only rebuild the tree-sitter packages that have native modules
      const packagesToRebuild = [
        'tree-sitter',
        'tree-sitter-javascript',
        'tree-sitter-python',
        'tree-sitter-rust',
        'tree-sitter-typescript'
      ];

      console.log('Rebuilding native modules:', packagesToRebuild.join(', '));
      execSync(`npm rebuild ${packagesToRebuild.join(' ')}`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
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
      const packagesToRebuild = [
        'tree-sitter',
        'tree-sitter-javascript',
        'tree-sitter-python',
        'tree-sitter-rust',
        'tree-sitter-typescript'
      ];
      execSync(`npm rebuild ${packagesToRebuild.join(' ')}`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
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