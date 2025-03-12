import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./components/Login";
import Home from "./components/Home";
import DebateSim from "./components/DebateSim";
import Debate from "./components/Debate";
import Judge from "./components/Judge";
import Legislation from "./components/Legislation";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    // Check if a guest user is persisted in localStorage
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setLoading(false);
    } else {
      // Subscribe to Firebase auth state only if there's no persisted guest user
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [auth]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
    // Remove persisted guest user (if any)
    localStorage.removeItem("user");
    setUser(null);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {!user ? (
          <Route path="*" element={<Login onLogin={setUser} />} />
        ) : (
          <>
            <Route path="/" element={<Home user={user} onLogout={handleLogout} />} />
            <Route path="/debatesim" element={<DebateSim user={user} />} />
            <Route path="/debate" element={<Debate />} />
            <Route path="/judge" element={<Judge />} />
            <Route path="/legislation" element={<Legislation />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;