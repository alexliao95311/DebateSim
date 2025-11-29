import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, User, Settings, LogOut, History, Home } from 'lucide-react';
import { useTranslation } from '../utils/translations';
import './UserDropdown.css';

const UserDropdown = ({ user, onLogout, className = '' }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSettingsClick = () => {
    setIsOpen(false);
    navigate('/settings');
  };

  const handleHomeClick = () => {
    setIsOpen(false);
    navigate('/');
  };

  const handleHistoryClick = () => {
    setIsOpen(false);
    navigate('/history');
  };

  const handleLogoutClick = () => {
    setIsOpen(false);
    onLogout();
  };

  return (
    <div className={`user-dropdown ${className}`} ref={dropdownRef}>
      <button
        className="user-dropdown-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User menu"
      >
        <Menu size={20} />
      </button>

      {isOpen && (
        <div className="user-dropdown-menu">
          <div className="user-dropdown-item user-info">
            <User size={16} />
            <span>{user?.displayName || t('userDropdown.guest')}</span>
          </div>

          <button
            className="user-dropdown-item user-dropdown-button"
            onClick={handleHomeClick}
          >
            <Home size={16} />
            <span>{t('userDropdown.backToHome')}</span>
          </button>

          <button
            className="user-dropdown-item user-dropdown-button"
            onClick={handleHistoryClick}
          >
            <History size={16} />
            <span>{t('userDropdown.history')}</span>
          </button>

          <button
            className="user-dropdown-item user-dropdown-button"
            onClick={handleSettingsClick}
          >
            <Settings size={16} />
            <span>{t('userDropdown.settings')}</span>
          </button>

          <button
            className="user-dropdown-item user-dropdown-button logout"
            onClick={handleLogoutClick}
          >
            <LogOut size={16} />
            <span>{t('userDropdown.logout')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserDropdown;