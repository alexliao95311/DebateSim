import React from 'react';
import './DebateSidebar.css';

const DebateSidebar = ({ sidebarExpanded, setSidebarExpanded, speechList, scrollToSpeech }) => {
  return (
    <>
      <button 
        className="toggle-sidebar" 
        onClick={() => setSidebarExpanded(!sidebarExpanded)}
      >
        {sidebarExpanded ? "Hide Speeches" : "Show Speeches"}
      </button>
      
      <div className={`debate-sidebar ${sidebarExpanded ? "expanded" : ""}`}>
        <h3 className="sidebar-title">Speeches</h3>
        <ul className="sidebar-list">
          {speechList
            .filter((item) => item.title !== "Bill Description")
            .map((item) => (
              <li 
                key={item.id} 
                className="sidebar-item"
                onClick={() => scrollToSpeech(item.id)}
              >
                <span className="sidebar-text">{item.title}</span>
              </li>
            ))}
        </ul>
      </div>
    </>
  );
};

export default DebateSidebar;