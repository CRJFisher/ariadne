#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { pipeline } = require('stream/promises');
const tar = require('tar');

const GITHUB_REPO = 'CRJFisher/refscope';
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
        'User-Agent': 'refscope-installer'
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
  // Skip if running in CI or if explicitly building from source
  if (process.env.CI || process.env.npm_config_build_from_source) {
    console.log('Skipping prebuild download (CI or build-from-source)');
    return;
  }
  
  // Try to download prebuilds
  const success = await downloadPrebuilds();
  
  if (!success) {
    // Fall back to building from source
    console.log('Building native modules from source...');
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