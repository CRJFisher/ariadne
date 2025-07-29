# Native Module Support

Ariadne uses tree-sitter packages that include native modules. These packages provide their own prebuilt binaries for common platforms, eliminating the need for most users to have build tools installed.

## How it Works

When you run `npm install @ariadnejs/core`, tree-sitter packages are automatically installed with their prebuilt binaries for your platform. No additional steps are required.

## Supported Platforms

Tree-sitter packages provide prebuilt binaries for:
- Linux x64
- macOS x64
- macOS arm64 (Apple Silicon)
- Windows x64

## Building from Source

If you're on an unsupported platform or prefer to build from source:

```bash
npm install @ariadnejs/core --build-from-source
```

## Troubleshooting

### Missing Build Tools

If your platform is not supported by tree-sitter's prebuilt binaries, you'll need build tools installed:

**On Ubuntu/Debian:**
```bash
sudo apt-get install build-essential
```

**On macOS:**
```bash
xcode-select --install
```

**On Windows:**
Install Visual Studio Build Tools or use WSL with Linux build tools.

### Forcing a Rebuild

To force rebuilding the native modules:
```bash
npm rebuild
```

Or for specific tree-sitter packages:
```bash
npm rebuild tree-sitter tree-sitter-javascript tree-sitter-python tree-sitter-rust tree-sitter-typescript
```