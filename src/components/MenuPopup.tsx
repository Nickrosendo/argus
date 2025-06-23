import React, { useState, useRef, useEffect } from 'react';
import { Settings, User, Menu } from 'lucide-react';

type MenuAction = "settings" | "account";

interface MenuPopupProps {
  onAction: (action: MenuAction) => void;
  isAuthenticated: boolean;
  isFreeMode: boolean;
}

const MenuPopup: React.FC<MenuPopupProps> = ({ onAction, isAuthenticated, isFreeMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = (action: MenuAction) => {
    onAction(action);
    setIsOpen(false);
  };

  return (
    <div className="menu-popup" ref={menuRef}>
      <button
        className="menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="menu-dropdown">
          <button
            className="menu-item"
            onClick={() => handleAction('settings')}
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </button>
          
          <button
            className="menu-item"
            onClick={() => handleAction('account')}
          >
            <User className="h-4 w-4" />
            <span>Account</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default MenuPopup; 