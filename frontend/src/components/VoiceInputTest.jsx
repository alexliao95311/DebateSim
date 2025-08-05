import React, { useState } from 'react';
import VoiceInput from './VoiceInput';

const VoiceInputTest = () => {
  const [transcript, setTranscript] = useState('');

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Voice Input Test</h1>
      <p>Test the voice input functionality:</p>
      
      <VoiceInput 
        onTranscript={setTranscript}
        placeholder="Click to start speaking..."
      />
      
      <div style={{ marginTop: '2rem' }}>
        <h3>Current Transcript:</h3>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={4}
          style={{ width: '100%', padding: '0.5rem' }}
          placeholder="Transcript will appear here..."
        />
      </div>
      
      <div style={{ marginTop: '1rem' }}>
        <button onClick={() => setTranscript('')}>
          Clear Transcript
        </button>
      </div>
    </div>
  );
};

export default VoiceInputTest; 