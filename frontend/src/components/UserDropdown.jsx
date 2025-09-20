import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, User, Settings, LogOut, History } from 'lucide-react';
import './UserDropdown.css';

const UserDropdown = ({ user, onLogout, className = '' }) => {
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
            <span>{user?.displayName || 'Guest'}</span>
          </div>

          <button
            className="user-dropdown-item user-dropdown-button"
            onClick={handleHistoryClick}
          >
            <History size={16} />
            <span>History</span>
          </button>

          <button
            className="user-dropdown-item user-dropdown-button"
            onClick={handleSettingsClick}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>

          <button
            className="user-dropdown-item user-dropdown-button logout"
            onClick={handleLogoutClick}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserDropdown;