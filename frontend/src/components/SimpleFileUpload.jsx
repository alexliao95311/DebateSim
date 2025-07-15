import React, { useRef, useState } from 'react';

const SimpleFileUpload = ({ onTextExtracted, disabled = false }) => {
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();

    // Check supported file types
    const isTxt = fileType === 'text/plain' || fileName.endsWith('.txt');
    const isPdf = fileType === 'application/pdf' || fileName.endsWith('.pdf');

    if (!isTxt && !isPdf) {
      alert('Only .txt and .pdf files are supported.');
      return;
    }

    // Check file size
    const maxSize = isPdf ? 50 * 1024 * 1024 : 5 * 1024 * 1024; // 50MB for PDF, 5MB for TXT
    if (file.size > maxSize) {
      alert(`File size must be less than ${isPdf ? '50MB' : '5MB'}.`);
      return;
    }

    setIsProcessing(true);

    try {
      if (isTxt) {
        // Handle TXT files locally
        await handleTxtFile(file);
      } else if (isPdf) {
        // Handle PDF files via server
        await handlePdfFile(file);
      }
    } catch (error) {
      console.error('File processing error:', error);
      alert(error.message || 'Failed to process the file.');
    } finally {
      setIsProcessing(false);
      // Clear the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleTxtFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        if (text && text.trim()) {
          onTextExtracted(text.trim());
          resolve();
        } else {
          reject(new Error('The text file appears to be empty.'));
        }
      };
      reader.onerror = () => {
        reject(new Error('Failed to read the text file.'));
      };
      reader.readAsText(file);
    });
  };

  const handlePdfFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
    
    const response = await fetch(`${API_URL}/extract-text`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Server error: ${response.status}`);
    }

    const data = await response.json();
    if (data.text && data.text.trim()) {
      onTextExtracted(data.text.trim());
    } else {
      throw new Error('No readable text found in the PDF.');
    }
  };

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.pdf"
        onChange={handleFileSelect}
        disabled={disabled || isProcessing}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isProcessing}
        style={{
          background: isProcessing ? '#6c757d' : '#28a745',
          color: 'white',
          border: 'none',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          fontSize: '0.9rem',
          cursor: (disabled || isProcessing) ? 'not-allowed' : 'pointer',
          opacity: (disabled || isProcessing) ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}
      >
        {isProcessing ? (
          <>
            <span style={{ 
              width: '12px', 
              height: '12px', 
              border: '2px solid #ffffff40',
              borderTop: '2px solid #ffffff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></span>
            Processing...
          </>
        ) : (
          <>📄 Upload PDF or TXT file</>
        )}
      </button>
      <small style={{ 
        display: 'block', 
        color: '#666', 
        marginTop: '0.25rem',
        fontSize: '0.8rem'
      }}>
        Upload a PDF or TXT file to automatically fill the text area
      </small>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SimpleFileUpload;