import React from 'react';
import { useTranslation } from '../utils/translations';
import './DebateSidebar.css';

const AnalysisSidebar = ({ sidebarExpanded, setSidebarExpanded, sectionList, scrollToSection }) => {
  const { t } = useTranslation();
  return (
    <>
      <button 
        className="toggle-sidebar" 
        onClick={() => setSidebarExpanded(!sidebarExpanded)}
      >
        {sidebarExpanded ? t('analysisSidebar.hideSections') : t('analysisSidebar.showSections')}
      </button>
      
      <div className={`debate-sidebar ${sidebarExpanded ? "expanded" : ""}`}>
        <h3 className="sidebar-title">{t('analysisSidebar.tableOfContents')}</h3>
        <ul className="sidebar-list">
          {sectionList.map((item) => (
            <li 
              key={item.id} 
              className="sidebar-item"
              onClick={() => scrollToSection(item.id)}
            >
              <span className="sidebar-text">{item.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default AnalysisSidebar;

