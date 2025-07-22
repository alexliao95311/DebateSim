import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./components/Login";
import Home from "./components/Home";
import DebateSim from "./components/DebateSim";
import Debate from "./components/Debate";
import Judge from "./components/Judge";
import Legislation from "./components/Legislation";
import PublicTranscriptView from "./components/PublicTranscriptView";

// Component to handle scroll reset on route changes
function ScrollToTop() {
  const location = useLocation();
  
  useEffect(() => {
    // Force scroll to top on route change with multiple methods
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);
  
  return null;
}

// Component to handle login redirects
function LoginRedirectHandler({ user, onRedirectHandled }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const redirectPreference = localStorage.getItem('loginRedirect');
      if (redirectPreference === 'debatesim') {
        // Clear the redirect preference after using it
        localStorage.removeItem('loginRedirect');
        navigate('/debatesim');
      } else {
        navigate('/');
      }
      // Mark redirect as handled
      onRedirectHandled();
    }
  }, [user, navigate, onRedirectHandled]);

  return null;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialLoginHandled, setInitialLoginHandled] = useState(false);
  const auth = getAuth();

  useEffect(() => {
    // Check if a guest user is persisted in localStorage
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setLoading(false);
      setInitialLoginHandled(true);
    } else {
      // Subscribe to Firebase auth state only if there's no persisted guest user
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
        if (currentUser && !initialLoginHandled) {
          setInitialLoginHandled(true);
        }
      });
      return () => unsubscribe();
    }
  }, [auth, initialLoginHandled]);

  const handleLogin = (newUser) => {
    setUser(newUser);
    // Don't mark as handled here - let the redirect component handle it
  };

  const handleRedirectComplete = () => {
    setInitialLoginHandled(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
    // Remove persisted guest user (if any)
    localStorage.removeItem("user");
    localStorage.removeItem("loginRedirect");
    setUser(null);
    setInitialLoginHandled(false);
  };

  if (loading) {
    return (
      <div 
        className="main-loading-container"
        style={{
          backgroundColor: '#ededed',
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}
      >
        <div className="main-loading-text">Loading...</div>
      </div>
    );
  }

  return (
    <Router future={{ v7_startTransition: true }}>
      <ScrollToTop />
      {user && !initialLoginHandled && <LoginRedirectHandler user={user} onRedirectHandled={handleRedirectComplete} />}
      <Routes>
        {/* Public route for shared transcripts - accessible without login */}
        <Route path="/shared/:shareId" element={<PublicTranscriptView />} />
        
        {!user ? (
          <Route path="*" element={<Login onLogin={handleLogin} />} />
        ) : (
          <>
            <Route path="/" element={<Home user={user} onLogout={handleLogout} />} />
            <Route path="/debatesim" element={<DebateSim user={user} />} />
            <Route path="/debate" element={<Debate />} />
            <Route path="/judge" element={<Judge />} />
            <Route path="/legislation" element={<Legislation user={user} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;