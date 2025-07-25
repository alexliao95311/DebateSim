// Footer.jsx
import React from 'react';
import { MessageSquare, Code } from 'lucide-react';
import './Footer.css';

function Footer() {
    return (
        <footer className="footer">
            <div className="footer-links">
                <a
                    href="https://docs.google.com/forms/d/e/1FAIpQLSf_bXEj_AJSyY17WA779h-ESk4om3QmPFT4sdyce7wcnwBr7Q/viewform?usp=sharing&ouid=109634392449391866526"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="feedback-link"
                >
                    <MessageSquare size={16} />
                    Give Feedback
                </a>
                <a
                    href="https://github.com/alexliao95311/DebateSim"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="github-link"
                >
                    <Code size={16} />
                    GitHub
                </a>
            </div>
            <span className="copyright">&copy; {new Date().getFullYear()} DebateSim. All rights reserved.</span>
        </footer>
    );
}

export default Footer;  