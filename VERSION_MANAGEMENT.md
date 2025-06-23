# Version Management

This project uses a centralized version management system where the `package.json` file serves as the single source of truth for version information.

## How It Works

### 1. Single Source of Truth
- **`package.json`** contains the authoritative version number
- All other files reference or sync from this version

### 2. Automatic Synchronization

#### Frontend (Footer Component)
- `src/components/Footer.tsx` dynamically imports version from `package.json`
- Version is displayed as `v{version}` in the extension footer
- No manual updates needed - automatically stays in sync

#### Build Process
- `rollup.common.js` reads version from `package.json` during build
- Manifest files get version-replaced during the build process
- Both Chrome and Firefox builds use the same version source

#### Manual Sync Script
- `scripts/sync-version.js` updates manifest files to match `package.json`
- Available via `npm run sync-version`
- Useful for development and ensuring consistency

## Usage

### Updating the Version

1. **Update `package.json`**:
   ```json
   {
     "version": "1.2.0"
   }
   ```

2. **Sync manifest files**:
   ```bash
   npm run sync-version
   ```

3. **Build the extension**:
   ```bash
   npm run build
   ```

### Available Scripts

- `npm run sync-version` - Synchronizes version from package.json to manifest files
- `npm run build` - Builds both Chrome and Firefox versions with correct version

## Files Affected

- `package.json` - **Source of truth**
- `manifest.json` - Chrome extension manifest
- `manifest-firefox.json` - Firefox extension manifest  
- `src/components/Footer.tsx` - UI component showing version
- `tests/components/Footer.test.tsx` - Tests updated for dynamic version

## Benefits

- ✅ **Single source of truth** - No version conflicts
- ✅ **Automatic sync** - Footer always shows correct version
- ✅ **Build integration** - Manifest files get correct version during build
- ✅ **Developer friendly** - Easy to update version in one place
- ✅ **CI/CD ready** - Scripts can be integrated into deployment pipelines

## Migration Notes

Previously, versions were managed manually in multiple files:
- Footer component had hardcoded `v1.0.0`
- Manifest files needed manual updates
- Risk of version mismatches between files

The new system eliminates these issues by centralizing version management. 