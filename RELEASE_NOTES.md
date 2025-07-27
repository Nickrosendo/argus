# Argus - Screen Time Tracker Release Notes

## Version 1.0.4 (July 2025)

### 🆕 New Features
- **Google OAuth Integration**: Added secure Google sign-in functionality for user authentication
- **Social Authentication**: Implemented complete social auth system with Google OAuth 2.0
- **Payment Module Integration**: Enhanced payment processing capabilities with subscription management
- **Cross-Device Sync**: User data now syncs across devices when signed in

### 🔧 Improvements
- **Authentication UI**: Improved authentication interface and user experience
- **Subscription Status**: Enhanced subscription status fetching and management
- **Auth Service Endpoints**: Updated authentication service endpoints for better reliability
- **Error Handling**: Improved error handling throughout the authentication flow

### 🐛 Bug Fixes
- Fixed unit test coverage and reliability
- Resolved authentication state management issues
- Fixed social auth token handling

### 🔒 Security
- Added Chrome Identity API permission for secure OAuth flows
- Implemented proper token storage and management
- Enhanced security for user data synchronization

### 🛠️ Technical Changes
- Updated manifest to support Google OAuth 2.0 scopes
- Enhanced service worker architecture for auth handling
- Improved TypeScript type definitions for authentication
- Added comprehensive test coverage for new features

### 📋 Requirements
- Chrome 88+ or Firefox 79+
- Internet connection required for authentication and sync features

---

For support or feedback, please visit our [GitHub repository](https://github.com/your-repo/argus-extension).