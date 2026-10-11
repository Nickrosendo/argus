import React, { useState } from 'react';
import { Plan, PLANS } from '../lib/plans';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onPaymentSuccess }) => {
  const [selectedPlan, setSelectedPlan] = useState<Plan>(PLANS[1]); // Default to yearly
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePlanSelection = (plan: Plan) => {
    setSelectedPlan(plan);
    setError(null); // Clear any existing errors when switching plans
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Get auth token from storage
      const result = await browserAPI.storage.local.get(['authToken']);
      const authToken = result.authToken;

      if (!authToken) {
        setError('Please sign in to upgrade to premium');
        setIsProcessing(false);
        return;
      }

      // Call background script to create Stripe checkout session
      const response = await browserAPI.runtime.sendMessage({
        action: 'createCheckoutSession',
        priceId: selectedPlan.priceId,
        authToken: authToken,
      });

      if (response.success && response.checkoutUrl) {
        // Redirect to Stripe hosted checkout page
        await browserAPI.tabs.create({ url: response.checkoutUrl });
        onClose();
      } else {
        setError(response.error || 'Failed to create checkout session. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Payment error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">Upgrade to Premium</h2>
          <button 
            className="nav-icon-btn" 
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div className="modal-content">
          <div className="pricing-plans">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`glass-card pricing-plan ${selectedPlan.id === plan.id ? 'selected' : ''} ${plan.popular ? 'popular' : ''}`}
                onClick={() => handlePlanSelection(plan)}
              >
                {plan.popular && <div className="popular-badge">Most Popular</div>}
                <div className="plan-header">
                  <h3 className="plan-name">{plan.name}</h3>
                  <div className="plan-price">
                    <span className="price">{plan.price}</span>
                    <span className="period">/{plan.period}</span>
                  </div>
                </div>
                <div className="plan-features">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="feature">
                      <svg className="feature-check" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="error-message">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="modal-footer">
            <button 
              className="primary-btn"
              onClick={handlePayment}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="spinner"></div>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="btn-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                  </svg>
                  Upgrade for {selectedPlan.price}/{selectedPlan.period}
                </>
              )}
            </button>
            
            <div className="security-notice">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>Secure payment powered by Stripe</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
