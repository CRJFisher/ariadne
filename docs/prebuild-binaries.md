# Prebuilt Binaries

Ariadne includes support for prebuilt binaries to improve the installation experience. This means users don't need to have build tools (gcc, make, etc.) installed on their system to use Ariadne.

## How it Works

1. When you run `npm install @ariadnejs/core`, the postinstall script automatically checks for prebuilt binaries for your platform
2. If prebuilt binaries are available, they are downloaded and extracted
3. If prebuilt binaries are not available, the installation falls back to building from source

## Supported Platforms

Prebuilt binaries are provided for:
- Linux x64
- macOS x64
- macOS arm64 (Apple Silicon)
- Windows x64

## Building from Source

If you prefer to build from source or need to use Ariadne on an unsupported platform, you can force building from source:

```bash
npm install @ariadnejs/core --build-from-source
```

## Troubleshooting

### Missing Build Tools

If prebuilt binaries are not available for your platform and you don't have build tools installed, you'll see an error during installation. To fix this:

**On Ubuntu/Debian:**
```bash
sudo apt-get install build-essential
```

**On macOS:**
```bash
xcode-select --install
```

**On Windows:**
Install the windows-build-tools package:
```bash
npm install --global windows-build-tools
```

### Verifying Prebuilt Binary Usage

To check if prebuilt binaries were used during installation, look for this message in the npm install output:
```
Prebuilt binaries installed successfully!
```

If you see "Building native modules from source..." instead, it means prebuilt binaries were not available for your platform.

## For Maintainers

### Creating a New Release with Prebuilt Binaries

1. Create and push a new tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. The GitHub Actions workflow will automatically:
   - Build binaries for all supported platforms
   - Create a GitHub release
   - Attach the prebuilt binaries to the release

3. When users install the package, the postinstall script will download the appropriate prebuilt binaries from the GitHub release.

### Testing Prebuild Process

To test the prebuild process locally:

1. Set the CI environment variable to skip prebuild download:
   ```bash
   CI=true npm install
   ```

2. To test the download process (requires a published release):
   ```bash
   npm install
   ```