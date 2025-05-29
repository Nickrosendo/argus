import React, { useState } from 'react';

const AuthOverlay = ({ authMode, setAuthMode, onAuth, onFreeMode, onClose }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      // Simulate API call - replace with actual auth service
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock successful authentication
      const userData = {
        token: 'mock-token-' + Date.now(),
        user: {
          username: formData.username,
          email: formData.email || `${formData.username}@example.com`
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

  const validateForm = () => {
    const newErrors = {};
    
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

  const handleFormSubmit = (e) => {
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