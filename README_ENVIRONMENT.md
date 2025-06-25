# Environment Variables Setup

This document explains how to configure environment variables for the Argus Chrome Extension, specifically for OAuth client IDs and API server configuration.

## Setup

1. **Create Environment File**: Copy the example environment file to create your local configuration:
   ```bash
   cp .env.example .env
   ```

2. **Configure Variables**: Edit the `.env` file in the extension folder with your OAuth client IDs and API server URL:
   ```bash
   # Google OAuth Client ID (required for Chrome Identity API)
   GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   
   # Microsoft OAuth Client ID (required for Microsoft authentication)
   MICROSOFT_CLIENT_ID=your_microsoft_client_id_here
   
   # API Server URL (for connecting to your backend)
   # Development: http://localhost:3000
   # Production: https://argus-api-z73bt.kinsta.app
   API_URL=http://localhost:3000
   ```

## Environment Variables

### Required Variables

- **GOOGLE_CLIENT_ID**: Your Google OAuth 2.0 Client ID from Google Cloud Console (required for Chrome's identity API)
- **MICROSOFT_CLIENT_ID**: Your Microsoft OAuth Application (client) ID from Azure App Registrations
- **API_URL**: Your backend API server URL (supports both development and production environments)

### API URL Configuration

The `API_URL` environment variable allows you to easily switch between different environments:

- **Development**: `http://localhost:3000` (default)
- **Production**: `https://argus-api-z73bt.kinsta.app` (or your production server)
- **Custom**: Any valid HTTP/HTTPS URL for your API server

## Authentication Caching System

The extension implements an intelligent authentication caching system to minimize API requests:

### How It Works

1. **Smart Caching**: Authentication status is cached for 5 minutes after verification
2. **Automatic Invalidation**: Cache is cleared when:
   - User logs in or out
   - Authentication token changes
   - Authentication errors occur
3. **Manual Override**: Manual sync operations bypass the cache for fresh verification

### Cache Behavior

- **Automatic Checks**: Use cached authentication status when available
- **Manual Sync**: Forces fresh authentication check, bypassing cache
- **Token Changes**: Automatically invalidate cache when token changes

### Benefits

- **Reduced API Calls**: Minimizes server requests for better performance
- **Better UX**: Faster authentication checks for smoother user experience
- **Smart Refresh**: Only makes API calls when necessary

### OAuth Flow Details

- **Google Authentication**: Uses Chrome's `chrome.identity.getAuthToken()` API, which requires the client ID in the manifest.json oauth2 configuration
- **Microsoft Authentication**: Uses `chrome.identity.launchWebAuthFlow()` with automatic redirect URL generation

### Where They're Used

1. **Manifest.json**: 
   - Google Client ID is injected into the oauth2 configuration for Chrome's identity API
   - API URL is dynamically added to the Content Security Policy (CSP) connect-src directive
2. **SocialAuthService.js**: Both client IDs are injected into the OAuth configurations
3. **Background Scripts**: API URL is available as `process.env.API_URL` for backend communication
4. **AuthService.js**: Implements authentication caching with API_URL for token verification

## Build Process

The environment variables are automatically loaded and injected during the build process:

- **Development**: `npm run build:chrome:dev` or `npm run build:firefox:dev`
- **Production**: `npm run build:chrome` or `npm run build:firefox`

### Build Output

During build, you'll see confirmation messages:
```
Successfully loaded environment variables from extension .env file
Environment variables loaded:
- GOOGLE_CLIENT_ID: your_google_client_id...
- MICROSOFT_CLIENT_ID: your_micro...
- API_URL: http://localhost:3000
```

If variables are missing, you'll see warnings:
```
Warning: GOOGLE_CLIENT_ID is using fallback value. Please set it in the extension .env file.
Warning: MICROSOFT_CLIENT_ID is using fallback value. Please set it in the extension .env file.
Info: Using default API_URL (localhost:3000). Set API_URL in .env for production.
```

## Environment-Specific Builds

### Development Build
```bash
# .env file
API_URL=http://localhost:3000

# Build
npm run build:chrome:dev
```

### Production Build
```bash
# .env file
API_URL=https://argus-api-z73bt.kinsta.app

# Build
npm run build:chrome
```

## OAuth Flow Benefits

### Google Authentication
- Uses Chrome's secure `chrome.identity.getAuthToken()` API
- No manual redirect URL management needed
- Automatic token refresh and user consent handling
- Requires client ID in manifest.json for proper configuration

### Microsoft Authentication  
- Uses `chrome.identity.launchWebAuthFlow()` with automatic redirect URL generation
- Chrome automatically generates and handles the redirect URL
- Secure OAuth 2.0 flow with proper state management

## File Structure

```
argus-extension/
├── .env                    # Your environment variables (not in git)
├── .env.example           # Template file (in git)
├── manifest.json          # Template with placeholders (__GOOGLE_CLIENT_ID__, __API_URL__)
├── services/
│   ├── SocialAuthService.js # OAuth service with client ID placeholders
│   ├── AuthService.js      # Authentication service with caching and API_URL
│   └── ApiService.js       # API service with configurable API_URL
└── dist/
    └── chrome/
        ├── manifest.json           # Built with actual values injected
        └── services/
            ├── SocialAuthService.js # Built with actual client IDs
            ├── AuthService.js      # Built with actual API_URL and caching
            └── ApiService.js       # Built with actual API_URL
```

## Security Notes

- The `.env` file is excluded from git via `.gitignore`  
- All variables are injected at build time, not runtime
- Built files contain the actual values
- Chrome's identity APIs provide secure OAuth handling
- API URL is dynamically added to CSP for secure connections
- Authentication caching uses secure token validation

## Troubleshooting

1. **"Invalid OAuth2 Client ID" error**: Ensure your Google Client ID is correctly set in the .env file and the extension is properly configured in Google Cloud Console
2. **Variables not loading**: Ensure `.env` file exists in the extension folder (argus-extension)
3. **Build warnings**: Check that your `.env` file has all required variables (GOOGLE_CLIENT_ID, MICROSOFT_CLIENT_ID, API_URL)
4. **API connection errors**: Verify API_URL is correct and the server is running
5. **CSP violations**: Ensure your API URL matches the one in the .env file exactly
6. **Authentication cache issues**: Check browser console for authentication cache logs

## OAuth Configuration Requirements

### Google Cloud Console
- Set your Google Client ID in the .env file
- Ensure your extension's domain is added to authorized origins in Google Cloud Console
- Configure proper OAuth 2.0 scopes for email and profile access

### Microsoft Azure App Registration
- Set your Microsoft Client ID in the .env file
- Configure redirect URLs in Azure to include Chrome extension URLs
- Ensure proper scopes are configured for User.Read access

## Benefits of Environment Variable Approach

1. **Flexible Deployment**: Easy switching between development and production environments
2. **Secure Configuration**: Sensitive values kept out of source code
3. **Dynamic CSP**: API URLs automatically added to Content Security Policy
4. **Build-Time Injection**: Variables replaced during build for optimal performance
5. **Cross-Platform Support**: Works with both Chrome and Firefox extensions
6. **Proper Token Management**: Chrome handles OAuth token refresh and storage
7. **Intelligent Caching**: Minimizes API requests while maintaining security 