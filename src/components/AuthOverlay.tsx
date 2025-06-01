import React, { useState } from 'react';
import { UserInfo } from '../types/storage';

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
  user: UserInfo;
}

interface AuthOverlayProps {
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  onAuth: (success: boolean, userData?: UserData) => void;
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
      // Simulate API call - replace with actual auth service
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock successful authentication
      const userData: UserData = {
        token: 'mock-token-' + Date.now(),
        user: {
          id: 'user-' + Date.now(),
          email: formData.email || `${formData.username}@example.com`,
          name: formData.username
        }
      };
      
      onAuth(true, userData);
    } catch (error) {
      setErrors({
        general: 'Authentication failed. Please try again.'
      });
    } finally {
      setLoading(false);
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
          
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Loading...' : (authMode === 'signin' ? 'Sign In' : 'Sign Up')}
          </button>
          
          {errors.general && <div className="auth-error">{errors.general}</div>}
        </form>
        
        <div className="free-mode-option">
          <p>Or</p>
          <button onClick={onFreeMode} className="free-mode-btn">
            Use without account
          </button>
          <small>Limited features, ads may be displayed</small>
        </div>
      </div>
    </div>
  );
};

export default AuthOverlay; 