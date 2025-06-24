import React, { useState } from 'react';
import { UserInfo } from '../types/storage';
import { useBrowserMessaging } from '../hooks/useBrowserMessaging';

type AuthMode = 'signin' | 'signup';

interface FormData {
  username: string;
  email: string;
  password: string;
}

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  general?: string;
}

interface UserData {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

interface AuthOverlayProps {
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  onAuth: (isAuthenticated: boolean, userData?: UserData) => void;
  onFreeMode: () => void;
  onClose?: () => void;
}

const AuthOverlay: React.FC<AuthOverlayProps> = ({ authMode, setAuthMode, onAuth, onFreeMode, onClose }) => {
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [socialLoading, setSocialLoading] = useState<{ google: boolean; microsoft: boolean }>({
    google: false,
    microsoft: false
  });
  
  const { signin, signup, socialAuth } = useBrowserMessaging();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      // Call background service worker to handle authentication
      const response = authMode === 'signin' 
        ? await signin(formData.username, formData.password)
        : await signup(formData.username, formData.password, formData.email);
      
      console.log('Authentication response:', response);
      if (response.success && response.data) {
        const userData: UserData = {
          token: response.data.token,
          user: response.data.user
        };
        
        onAuth(true, userData);
      } else {
        setErrors({
          general: response.error || 'Authentication failed. Please try again.'
        });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setErrors({
        general: 'Authentication failed. Please check your connection and try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = async (provider: 'google' | 'microsoft'): Promise<void> => {
    setSocialLoading(prev => ({ ...prev, [provider]: true }));
    setErrors({});

    try {
      const response = await socialAuth(provider);
      
      if (response.success && response.data) {
        const userData: UserData = {
          token: response.data.token,
          user: response.data.user
        };
        
        onAuth(true, userData);
      } else {
        setErrors({
          general: response.error || `${provider} authentication failed. Please try again.`
        });
      }
    } catch (error) {
      console.error(`${provider} authentication error:`, error);
      setErrors({
        general: `${provider} authentication failed. Please check your connection and try again.`
      });
    } finally {
      setSocialLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    
    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (authMode === 'signup' && !formData.email.trim()) {
      newErrors.email = 'Email is required';
    }
    
    if (authMode === 'signup' && formData.email.trim() && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    return newErrors;
  };

  const handleFormSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const validationErrors = validateForm();
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    handleSubmit(e);
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        {onClose && (
          <button className="auth-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
        <img src="icons/icon128.png" alt="Argus Logo" className="auth-logo" />
        <h2>Welcome to Argus</h2>
        
        <div className="auth-tabs">
          <button 
            className={`auth-tab-btn ${authMode === 'signin' ? 'active' : ''}`}
            onClick={() => setAuthMode('signin')}
          >
            Sign In
          </button>
          <button 
            className={`auth-tab-btn ${authMode === 'signup' ? 'active' : ''}`}
            onClick={() => setAuthMode('signup')}
          >
            Sign Up
          </button>
        </div>

        {/* Social Login Buttons */}
        <div className="social-auth-section">
          <button 
            className="social-auth-btn google-btn"
            onClick={() => handleSocialAuth('google')}
            disabled={socialLoading.google || socialLoading.microsoft}
          >
            <div className="social-btn-content">
              <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" className="social-icon" />
              {socialLoading.google ? 'Signing in...' : `Continue with Google`}
            </div>
          </button>
          
          <button 
            className="social-auth-btn microsoft-btn"
            onClick={() => handleSocialAuth('microsoft')}
            disabled={socialLoading.google || socialLoading.microsoft}
          >
            <div className="social-btn-content">
              <img src="https://img.icons8.com/color/16/000000/microsoft.png" alt="Microsoft" className="social-icon" />
              {socialLoading.microsoft ? 'Signing in...' : `Continue with Outlook`}
            </div>
          </button>
        </div>

        <div className="auth-divider">
          <span>or</span>
        </div>
        
        <form onSubmit={handleFormSubmit} className="auth-form active">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              required
            />
            {errors.username && <div className="field-error">{errors.username}</div>}
          </div>
          
          {authMode === 'signup' && (
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
              {errors.email && <div className="field-error">{errors.email}</div>}
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
            />
            {authMode === 'signup' && (
              <small>Must be at least 6 characters</small>
            )}
            {errors.password && <div className="field-error">{errors.password}</div>}
          </div>
          
          <button type="submit" className="auth-submit" disabled={loading || socialLoading.google || socialLoading.microsoft}>
            {loading ? 'Loading...' : (authMode === 'signin' ? 'Sign In' : 'Sign Up')}
          </button>
          
          {errors.general && <div className="auth-error">{errors.general}</div>}
        </form>

        <button className="free-mode-btn" onClick={onFreeMode}>
          Continue in Free Mode
        </button>
      </div>
    </div>
  );
};

export default AuthOverlay; 
