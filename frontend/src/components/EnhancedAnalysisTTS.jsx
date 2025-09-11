import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { TTS_CONFIG, getVoiceForContext, getTTSEndpoint } from '../config/tts';
import './VoiceOutput.css';

// Create a context for TTS functionality
const TTSContext = createContext();

// Function to strip markdown syntax and clean up symbols for TTS
const stripMarkdown = (text) => {
  if (!text) return '';
  
  return text
    // Remove headers (###, ##, #) - enhanced to catch any missed cases
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/#{1,6}\s*/g, '')  // Also remove any remaining # symbols inline
    // Remove bold/italic markers (**text**, *text*)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    // Remove code blocks (```code```)
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code (`code`)
    .replace(/`([^`]+)`/g, '$1')
    // Remove links [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove horizontal rules (---, ***)
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove blockquotes (> text)
    .replace(/^>\s+/gm, '')
    // Remove list markers (- item, * item, 1. item)
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Remove emphasis markers (_text_)
    .replace(/_(.*?)_/g, '$1')
    // Remove strikethrough (~~text~~)
    .replace(/~~(.*?)~~/g, '$1')
    // Fix problematic symbols that cause misreading
    .replace(/["""""'']/g, '')  // Remove all quote variants entirely to prevent "inches" reading
    .replace(/'/g, "'")         // Keep apostrophes for contractions
    // Handle other symbols that might cause misreading
    .replace(/\(/g, ' ')        // Replace parentheses with spaces for cleaner speech
    .replace(/\)/g, ' ')
    .replace(/\[/g, ' ')        // Replace brackets with spaces  
    .replace(/\]/g, ' ')
    .replace(/—/g, ' - ') // Replace em dash with spaced dash
    .replace(/–/g, ' - ') // Replace en dash with spaced dash
    .replace(/\.\.\./g, ', pause,') // Replace ellipsis with pause
    // Remove any remaining pause markers that might be read aloud
    .replace(/\[PAUSE\]/gi, '')
    .replace(/\.\.\.?\s*\[PAUSE\]/gi, '')
    // Remove any stray hash symbols that might remain
    .replace(/#/g, '')
    // Clean up extra whitespace
    .replace(/\n\s*\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
};

// Function to add natural pauses after headings for better TTS flow
const addHeadingPauses = (text) => {
  if (!text) return '';
  
  // Add natural pauses after headings using longer punctuation and spacing
  return text
    // Add longer pause after section headings - use multiple periods for longer pause
    .replace(/^([A-Z][A-Za-z\s:]+)$/gm, '$1...') // Standalone headings get triple dots
    // Add pause after numbered headings like "1. Heading"
    .replace(/(\d+\.\s+[^\n]+)/g, '$1...')
    // Add pause after headings that end with colon
    .replace(/([^.!?]):\s*$/gm, '$1:...')
    // Add pause after words in ALL CAPS (likely headings)
    .replace(/\b([A-Z]{3,})\b/g, '$1...')
    // Add extra pause between major sections
    .replace(/\n([A-Z][A-Za-z\s:]+)\n/g, '\n\n$1...\n\n')
    // Add natural breathing pauses at sentence boundaries with better spacing
    .replace(/([.!?])\s*([A-Z])/g, '$1  $2') // Two spaces for slight pause
    // Convert triple dots to comma pauses for more natural speech
    .replace(/\.\.\./g, ', , ,'); // Multiple commas create pauses in TTS
};

// Function to split text into chunks by H2 headers only
const parseAnalysisIntoSections = (text) => {
  if (!text) return [];
  
  const lines = text.split('\n');
  const sections = [];
  let currentSection = null;
  
  lines.forEach(line => {
    const trimmedLine = line.trim();
    
    // Check if line is an H2 header (starts with ##)
    const isH2Header = /^##\s+/.test(trimmedLine);
    
    if (isH2Header) {
      // Save previous section if exists
      if (currentSection) {
        sections.push(currentSection);
      }
      
      // Start new section
      currentSection = {
        header: trimmedLine.replace(/^##\s+/, ''),
        content: [trimmedLine],
        id: `section-${sections.length}`
      };
    } else if (currentSection) {
      // Add content to current section (including H1, H3, H4, paragraphs, etc.)
      currentSection.content.push(line);
    } else if (!currentSection && trimmedLine) {
      // Handle content before first H2 header
      if (sections.length === 0) {
        sections.push({
          header: 'Introduction',
          content: [line],
          id: 'section-intro'
        });
      }
    }
  });
  
  // Add the last section
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return sections.map(section => ({
    ...section,
    fullText: section.content.join('\n'),
    cleanText: stripMarkdown(section.content.join('\n'))
  }));
};

// Function to get byte length of text (UTF-8)
const getByteLength = (text) => {
  return new Blob([text]).size;
};

// Function to split text into TTS-friendly chunks by headers first, then by byte length
const chunkTextForTTS = (text, maxChunkBytes = 3000) => { // Use 3000 bytes to be more conservative
  if (!text) return [];
  
  const cleanText = stripMarkdown(text);
  const textByteLength = getByteLength(cleanText);
  
  if (textByteLength <= maxChunkBytes) {
    return [cleanText];
  }
  
  // First, try to chunk by headers
  const headerChunks = chunkByHeaders(cleanText, maxChunkBytes);
  if (headerChunks.length > 1) {
    // Verify that all chunks are within size limit
    const validChunks = headerChunks.filter(chunk => getByteLength(chunk) <= maxChunkBytes);
    if (validChunks.length === headerChunks.length) {
      console.log(`Using ${headerChunks.length} header-based chunks`);
      return headerChunks;
    } else {
      console.log(`Header chunks too large, falling back to sentence chunking`);
    }
  }
  
  // If header chunking didn't help, fall back to sentence chunking
  const sentences = cleanText.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let currentChunk = '';
  
  sentences.forEach(sentence => {
    const testChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
    const testByteLength = getByteLength(testChunk);
    
    if (testByteLength <= maxChunkBytes) {
      currentChunk = testChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        // Single sentence is too long, need to split it further
        const words = sentence.split(/\s+/);
        let wordChunk = '';
        
        words.forEach(word => {
          const testWordChunk = wordChunk + (wordChunk ? ' ' : '') + word;
          if (getByteLength(testWordChunk) <= maxChunkBytes) {
            wordChunk = testWordChunk;
          } else {
            if (wordChunk) {
              chunks.push(wordChunk);
              wordChunk = word;
            } else {
              // Single word is too long, truncate it
              const truncated = word.substring(0, Math.floor(maxChunkBytes / 2));
              chunks.push(truncated);
              wordChunk = '';
            }
          }
        });
        
        if (wordChunk) {
          currentChunk = wordChunk;
        }
      }
    }
  });
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  // Debug logging to verify chunk sizes
  chunks.forEach((chunk, index) => {
    const byteSize = getByteLength(chunk);
    console.log(`Chunk ${index + 1}: ${byteSize} bytes (${chunk.length} chars)`);
    if (byteSize > 5000) {
      console.warn(`WARNING: Chunk ${index + 1} is ${byteSize} bytes, exceeds 5000 byte limit!`);
    }
  });
  
  return chunks;
};

// Function to chunk text by headers (##, ###, etc.)
const chunkByHeaders = (text, maxChunkBytes) => {
  const lines = text.split('\n');
  const chunks = [];
  let currentChunk = '';
  let currentHeader = '';
  
  console.log('Starting header-based chunking with maxChunkBytes:', maxChunkBytes);
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // More comprehensive header detection
    const isHeader = 
      /^#{1,6}\s+/.test(trimmedLine) ||  // #, ##, ###, etc.
      /^\d+\.\s+[A-Z]/.test(trimmedLine) ||  // 1. Title, 2. Title, etc.
      /^[A-Z][A-Za-z\s]+:$/.test(trimmedLine) ||  // TITLE: or Section Name:
      /^[A-Z][A-Za-z\s]+\s*$/.test(trimmedLine) && trimmedLine.length < 100; // Standalone titles
    
    if (isHeader) {
      console.log(`Found header at line ${index}: "${trimmedLine}"`);
      
      // If we have content in current chunk, save it
      if (currentChunk.trim()) {
        const testChunk = currentChunk.trim();
        const testByteLength = getByteLength(testChunk);
        
        console.log(`Saving chunk with ${testByteLength} bytes (${testChunk.length} chars)`);
        
        if (testByteLength <= maxChunkBytes) {
          chunks.push(testChunk);
        } else {
          // Header chunk is too big, split it by sentences
          console.log(`Chunk too big (${testByteLength} bytes), splitting by sentences`);
          const sentenceChunks = splitChunkBySentences(testChunk, maxChunkBytes);
          chunks.push(...sentenceChunks);
        }
      }
      
      // Start new chunk with header
      currentChunk = line + '\n';
      currentHeader = trimmedLine.replace(/^#{1,6}\s+/, '').replace(/^(\d+\.\s+)/, '');
    } else if (trimmedLine) {
      // Add content to current chunk
      currentChunk += line + '\n';
    }
  });
  
  // Add the last chunk
  if (currentChunk.trim()) {
    const testChunk = currentChunk.trim();
    const testByteLength = getByteLength(testChunk);
    
    console.log(`Saving final chunk with ${testByteLength} bytes (${testChunk.length} chars)`);
    
    if (testByteLength <= maxChunkBytes) {
      chunks.push(testChunk);
    } else {
      // Header chunk is too big, split it by sentences
      console.log(`Final chunk too big (${testByteLength} bytes), splitting by sentences`);
      const sentenceChunks = splitChunkBySentences(testChunk, maxChunkBytes);
      chunks.push(...sentenceChunks);
    }
  }
  
  console.log(`Header chunking created ${chunks.length} chunks`);
  return chunks;
};

// Helper function to split a chunk by sentences if it's too big
const splitChunkBySentences = (chunk, maxChunkBytes) => {
  console.log(`Splitting chunk by sentences (${chunk.length} chars, ${getByteLength(chunk)} bytes)`);
  
  // First try splitting by paragraphs (double newlines)
  const paragraphs = chunk.split(/\n\s*\n/);
  if (paragraphs.length > 1) {
    const paragraphChunks = [];
    paragraphs.forEach(paragraph => {
      const trimmedParagraph = paragraph.trim();
      if (trimmedParagraph) {
        const byteLength = getByteLength(trimmedParagraph);
        if (byteLength <= maxChunkBytes) {
          paragraphChunks.push(trimmedParagraph);
        } else {
          // Paragraph too big, split by sentences
          const sentenceChunks = splitBySentences(trimmedParagraph, maxChunkBytes);
          paragraphChunks.push(...sentenceChunks);
        }
      }
    });
    return paragraphChunks;
  }
  
  // If no paragraphs, split by sentences
  return splitBySentences(chunk, maxChunkBytes);
};

// Helper function to split by sentences
const splitBySentences = (text, maxChunkBytes) => {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let currentChunk = '';
  
  sentences.forEach(sentence => {
    const testChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
    const testByteLength = getByteLength(testChunk);
    
    if (testByteLength <= maxChunkBytes) {
      currentChunk = testChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        // Single sentence is too long, split by words
        const wordChunks = splitByWords(sentence, maxChunkBytes);
        chunks.push(...wordChunks);
      }
    }
  });
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
};

// Helper function to split by words
const splitByWords = (text, maxChunkBytes) => {
  const words = text.split(/\s+/);
  const chunks = [];
  let currentChunk = '';
  
  words.forEach(word => {
    const testChunk = currentChunk + (currentChunk ? ' ' : '') + word;
    if (getByteLength(testChunk) <= maxChunkBytes) {
      currentChunk = testChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = word;
      } else {
        // Single word is too long, truncate it
        const truncated = word.substring(0, Math.floor(maxChunkBytes / 2));
        chunks.push(truncated);
      }
    }
  });
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
};

// Custom hook to use TTS context
const useTTS = () => {
  const context = useContext(TTSContext);
  if (!context) {
    return null;
  }
  return context;
};

// TTS Provider component
const TTSProvider = ({ children, analysisText }) => {
  const [playingSections, setPlayingSections] = useState(new Set());
  const [sectionStates, setSectionStates] = useState(new Map());
  const audioRefs = useRef(new Map());
  const currentAudioUrls = useRef(new Map());
  
  // Parse analysis into sections
  const sections = parseAnalysisIntoSections(analysisText);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllSections();
    };
  }, []);
  
  const stopAllSections = () => {
    // Set stopped flag for all sections
    if (window.sectionChunks) {
      window.sectionChunks.forEach((sectionData) => {
        sectionData.isStopped = true;
      });
    }
    
    // Stop all audio and clean up
    audioRefs.current.forEach((audio, sectionId) => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    });
    
    // Clean up audio URLs
    currentAudioUrls.current.forEach((url, sectionId) => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    });
    
    // Cancel browser TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    // Clean up all section chunks
    if (window.sectionChunks) {
      window.sectionChunks.clear();
    }
    
    // Reset states
    setPlayingSections(new Set());
    setSectionStates(new Map());
    audioRefs.current.clear();
    currentAudioUrls.current.clear();
  };
  
  const setSectionState = (sectionId, state) => {
    setSectionStates(prev => new Map(prev.set(sectionId, state)));
  };
  
  const getSectionState = (sectionId) => {
    return sectionStates.get(sectionId) || { isPlaying: false, isPaused: false, isLoading: false };
  };
  
  // Play individual section by header text using same logic as EnhancedVoiceOutput
  const playSectionByHeader = async (headerText) => {
    // Find section by header text
    const section = sections.find(s => 
      s.header.toLowerCase().includes(headerText.toLowerCase()) ||
      headerText.toLowerCase().includes(s.header.toLowerCase())
    );
    
    if (!section) return;
    
    const sectionId = section.id;
    const currentState = getSectionState(sectionId);
    
    // If currently playing, stop it
    if (currentState.isPlaying) {
      stopSection(sectionId);
      return;
    }
    
    // If paused, resume
    if (currentState.isPaused) {
      resumeSection(sectionId);
      return;
    }
    
    // Start playing
    playSection(sectionId, section.cleanText);
  };
  
  const playSection = async (sectionId, text) => {
    try {
      // Set loading state
      setSectionState(sectionId, { isPlaying: false, isPaused: false, isLoading: true });
      setPlayingSections(prev => new Set(prev.add(sectionId)));
      
      // Clean the text and add pauses
      const cleanText = stripMarkdown(text);
      const textWithPauses = addHeadingPauses(cleanText);
      
      // Chunk the text for proper handling of long sections
      const chunks = chunkTextForTTS(textWithPauses);
      
      // Store chunks and start playing first chunk
      if (!window.sectionChunks) window.sectionChunks = new Map();
      window.sectionChunks.set(sectionId, { chunks, currentIndex: 0, isStopped: false });
      
      if (chunks.length > 0) {
        playSectionChunk(sectionId, chunks[0], 0);
      } else {
        setSectionState(sectionId, { isPlaying: false, isPaused: false, isLoading: false });
        setPlayingSections(prev => {
          const newSet = new Set(prev);
          newSet.delete(sectionId);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Section TTS error:', error);
      setSectionState(sectionId, { isPlaying: false, isPaused: false, isLoading: false });
      setPlayingSections(prev => {
        const newSet = new Set(prev);
        newSet.delete(sectionId);
        return newSet;
      });
    }
  };
  
  // Play individual chunk for a section
  const playSectionChunk = async (sectionId, chunkText, chunkIndex) => {
    // Update chunk index
    const sectionData = window.sectionChunks?.get(sectionId);
    if (sectionData) {
      sectionData.currentIndex = chunkIndex;
    }
    
    // Try Google TTS first
    const success = await playGoogleTTSForSection(sectionId, chunkText, chunkIndex);
    if (!success) {
      // Fallback to browser TTS
      playBrowserTTSForSection(sectionId, chunkText, chunkIndex);
    }
  };
  
  // Play next chunk for a section
  const playNextSectionChunk = (sectionId) => {
    const sectionData = window.sectionChunks?.get(sectionId);
    if (!sectionData || sectionData.isStopped) return;
    
    const nextIndex = sectionData.currentIndex + 1;
    
    if (nextIndex >= sectionData.chunks.length) {
      // Finished all chunks for this section
      setSectionState(sectionId, { isPlaying: false, isPaused: false, isLoading: false });
      setPlayingSections(prev => {
        const newSet = new Set(prev);
        newSet.delete(sectionId);
        return newSet;
      });
      window.sectionChunks?.delete(sectionId);
      return;
    }
    
    // Play next chunk after brief pause
    setTimeout(() => {
      if (!sectionData.isStopped) {
        playSectionChunk(sectionId, sectionData.chunks[nextIndex], nextIndex);
      }
    }, 200);
  };
  
  const playGoogleTTSForSection = async (sectionId, text, chunkIndex = 0) => {
    try {
      const contextSettings = getVoiceForContext('debate');
      
      const response = await fetch(getTTSEndpoint('synthesize'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice_name: contextSettings.voice,
          rate: contextSettings.rate,
          pitch: contextSettings.pitch,
          volume: contextSettings.volume
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.audio_content) {
        // Convert base64 to audio and play
        const audioBlob = new Blob([
          Uint8Array.from(atob(data.audio_content), c => c.charCodeAt(0))
        ], { type: 'audio/mp3' });
        
        const audioUrl = URL.createObjectURL(audioBlob);
        currentAudioUrls.current.set(sectionId, audioUrl);
        
        // Create or get audio element
        let audio = audioRefs.current.get(sectionId);
        if (!audio) {
          audio = new Audio();
          audioRefs.current.set(sectionId, audio);
        }
        
        audio.src = audioUrl;
        audio.onloadedmetadata = () => {
          audio.play();
          setSectionState(sectionId, { isPlaying: true, isPaused: false, isLoading: false });
        };
        
        audio.onended = () => {
          // Clean up audio URL first
          const url = currentAudioUrls.current.get(sectionId);
          if (url === audioUrl) {
            URL.revokeObjectURL(audioUrl);
            currentAudioUrls.current.delete(sectionId);
          }
          
          // Play next chunk or end section
          playNextSectionChunk(sectionId);
        };
        
        audio.onerror = () => {
          setSectionState(sectionId, { isPlaying: false, isPaused: false, isLoading: false });
          setPlayingSections(prev => {
            const newSet = new Set(prev);
            newSet.delete(sectionId);
            return newSet;
          });
          // Clean up audio URL
          const url = currentAudioUrls.current.get(sectionId);
          if (url === audioUrl) {
            URL.revokeObjectURL(audioUrl);
            currentAudioUrls.current.delete(sectionId);
          }
        };
        
        return true;
      } else {
        throw new Error(data.error || 'Failed to synthesize speech');
      }
    } catch (error) {
      console.error('Google TTS error for section:', error);
      return false;
    }
  };
  
  const playBrowserTTSForSection = (sectionId, text, chunkIndex = 0) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      const contextSettings = getVoiceForContext('debate');
      
      utterance.rate = contextSettings.rate;
      utterance.pitch = contextSettings.pitch;
      utterance.volume = contextSettings.volume;
      
      utterance.onstart = () => {
        setSectionState(sectionId, { isPlaying: true, isPaused: false, isLoading: false });
      };
      
      utterance.onend = () => {
        // Play next chunk or end section
        playNextSectionChunk(sectionId);
      };
      
      utterance.onerror = () => {
        setSectionState(sectionId, { isPlaying: false, isPaused: false, isLoading: false });
        setPlayingSections(prev => {
          const newSet = new Set(prev);
          newSet.delete(sectionId);
          return newSet;
        });
      };
      
      utterance.onpause = () => {
        setSectionState(sectionId, { isPlaying: true, isPaused: true, isLoading: false });
      };
      
      utterance.onresume = () => {
        setSectionState(sectionId, { isPlaying: true, isPaused: false, isLoading: false });
      };
      
      window.speechSynthesis.speak(utterance);
    }
  };
  
  const pauseSection = (sectionId) => {
    const audio = audioRefs.current.get(sectionId);
    if (audio && audio.src) {
      audio.pause();
      setSectionState(sectionId, { isPlaying: true, isPaused: true, isLoading: false });
    } else if (window.speechSynthesis) {
      window.speechSynthesis.pause();
      setSectionState(sectionId, { isPlaying: true, isPaused: true, isLoading: false });
    }
  };
  
  const resumeSection = (sectionId) => {
    // Reset stopped flag when resuming
    const sectionData = window.sectionChunks?.get(sectionId);
    if (sectionData) {
      sectionData.isStopped = false;
    }
    
    const audio = audioRefs.current.get(sectionId);
    if (audio && audio.src) {
      audio.play();
      setSectionState(sectionId, { isPlaying: true, isPaused: false, isLoading: false });
    } else if (window.speechSynthesis) {
      window.speechSynthesis.resume();
      setSectionState(sectionId, { isPlaying: true, isPaused: false, isLoading: false });
    }
  };
  
  const stopSection = (sectionId) => {
    // Set stopped flag for this section to prevent chunk continuation
    const sectionData = window.sectionChunks?.get(sectionId);
    if (sectionData) {
      sectionData.isStopped = true;
    }
    
    // Stop audio
    const audio = audioRefs.current.get(sectionId);
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    
    // Clean up audio URL
    const audioUrl = currentAudioUrls.current.get(sectionId);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      currentAudioUrls.current.delete(sectionId);
    }
    
    // Stop browser TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    // Clean up section chunks
    window.sectionChunks?.delete(sectionId);
    
    // Update state
    setSectionState(sectionId, { isPlaying: false, isPaused: false, isLoading: false });
    setPlayingSections(prev => {
      const newSet = new Set(prev);
      newSet.delete(sectionId);
      return newSet;
    });
  };
  
  const contextValue = {
    playSectionByHeader,
    pauseSection,
    resumeSection,
    stopSection,
    getSectionState,
    sections,
    stopAllSections,
    sectionStates // Add the state directly to trigger re-renders
  };
  
  return (
    <TTSContext.Provider value={contextValue}>
      {children}
    </TTSContext.Provider>
  );
};

// Play button component for headers - matches EnhancedVoiceOutput.jsx UI exactly
const HeaderPlayButton = ({ headerText }) => {
  const tts = useTTS();
  
  if (!tts) return null;
  
  const { playSectionByHeader, pauseSection, resumeSection, stopSection, getSectionState, sections, sectionStates } = tts;
  
  // Find the section for this header
  const section = sections.find(s => 
    s.header.toLowerCase().includes(headerText.toLowerCase()) ||
    headerText.toLowerCase().includes(s.header.toLowerCase())
  );
  
  if (!section) return null;
  
  const sectionState = sectionStates.get(section.id) || { isPlaying: false, isPaused: false, isLoading: false };
  const { isPlaying, isPaused, isLoading } = sectionState;
  
  const handleClick = () => {
    if (isPlaying && !isPaused) {
      pauseSection(section.id);
    } else if (isPaused) {
      resumeSection(section.id);
    } else {
      playSectionByHeader(headerText);
    }
  };

  const handleStop = () => {
    stopSection(section.id);
  };
  
  return (
    <div className="voice-output-container" style={{ display: 'inline-block', marginLeft: '8px', verticalAlign: 'middle' }}>
      <div className="voice-output-controls">
        {!isPlaying && !isLoading ? (
          <button
            onClick={handleClick}
            className="voice-output-play-button voice-output-button-compact"
            title="Play this section"
            aria-label="Play section as speech"
          >
            <span className="voice-button-icon">▶️</span>
          </button>
        ) : isLoading ? (
          <button
            disabled={true}
            className="voice-output-play-button voice-output-button-compact"
            title="Loading..."
            aria-label="Loading speech"
          >
            <span className="voice-button-icon">⏳</span>
          </button>
        ) : (
          <div className="voice-output-playing-controls">
            {isPaused ? (
              <button
                onClick={handleClick}
                className="voice-output-resume-button voice-output-button-compact"
                title="Resume section"
                aria-label="Resume section speech"
              >
                <span className="voice-button-icon">▶️</span>
              </button>
            ) : (
              <button
                onClick={handleClick}
                className="voice-output-pause-button voice-output-button-compact"
                title="Pause section"
                aria-label="Pause section speech"
              >
                <span className="voice-button-icon">⏸️</span>
              </button>
            )}
            
            <button
              onClick={handleStop}
              className="voice-output-stop-button voice-output-button-compact"
              title="Stop section"
              aria-label="Stop section speech"
            >
              <span className="voice-button-icon">⏹️</span>
            </button>
            
            {/* Status Display - inline with buttons */}
            <div className="voice-output-status">
              <span className="voice-output-indicator">
                🔊 {isPaused ? 'Paused' : 'Playing...'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main component - uses same UI as EnhancedVoiceOutput.jsx
const EnhancedAnalysisTTS = ({ analysisText, title = "Analysis" }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);
  const utteranceRef = useRef(null);
  const audioRef = useRef(null);
  const currentAudioUrl = useRef(null);
  const chunksRef = useRef([]);
  const isStopped = useRef(false); // Add flag to track if user manually stopped
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopFullAnalysis();
    };
  }, []);
  
  const stopFullAnalysis = () => {
    // Set stopped flag first to prevent continuation
    isStopped.current = true;
    
    // Stop browser TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    // Stop audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    // Clean up audio URL
    if (currentAudioUrl.current) {
      URL.revokeObjectURL(currentAudioUrl.current);
      currentAudioUrl.current = null;
    }
    
    setIsPlaying(false);
    setIsPaused(false);
    setIsLoading(false);
    setCurrentChunk(0);
  };
  
  const playGoogleTTSChunk = async (text, retryCount = 0) => {
    try {
      // Check if stopped before making request
      if (isStopped.current) {
        return false;
      }
      
      const contextSettings = getVoiceForContext('debate');
      
      // Increase timeout for longer chunks and add retry logic
      const controller = new AbortController();
      const timeoutDuration = Math.max(20000, text.length * 0.2); // At least 20 seconds, or 0.2s per character
      const timeoutId = setTimeout(() => {
        console.log(`TTS request timeout after ${timeoutDuration}ms for chunk of ${text.length} characters`);
        controller.abort();
      }, timeoutDuration);
      
      const response = await fetch(getTTSEndpoint('synthesize'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice_name: contextSettings.voice,
          rate: contextSettings.rate,
          pitch: contextSettings.pitch,
          volume: contextSettings.volume
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.audio_content) {
        const audioBlob = new Blob([
          Uint8Array.from(atob(data.audio_content), c => c.charCodeAt(0))
        ], { type: 'audio/mp3' });
        
        const audioUrl = URL.createObjectURL(audioBlob);
        currentAudioUrl.current = audioUrl;
        
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.onloadedmetadata = () => {
            audioRef.current.play();
            setIsPlaying(true);
            setIsLoading(false);
          };
          
          audioRef.current.onended = () => {
            // Clean up current audio URL
            if (currentAudioUrl.current === audioUrl) {
              URL.revokeObjectURL(audioUrl);
              currentAudioUrl.current = null;
            }
            
            // Only play next chunk if not manually stopped
            if (!isStopped.current) {
              playNextChunk();
            }
          };
          
          audioRef.current.onerror = () => {
            // Clean up audio URL
            if (currentAudioUrl.current === audioUrl) {
              URL.revokeObjectURL(audioUrl);
              currentAudioUrl.current = null;
            }
            // Only try browser TTS if not manually stopped
            if (!isStopped.current) {
              playBrowserTTSChunk(text);
            } else {
              // If stopped, reset states properly
              setIsPlaying(false);
              setIsPaused(false);
              setIsLoading(false);
              setCurrentChunk(0);
            }
          };
        }
        
        return true;
      } else {
        throw new Error(data.error || 'Failed to synthesize speech');
      }
    } catch (error) {
      console.error('Google TTS error:', error);
      
      // Retry logic for network errors
      if (retryCount < 2 && (error.name === 'AbortError' || error.message.includes('timeout'))) {
        console.log(`Retrying TTS request (attempt ${retryCount + 1}/2)`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return playGoogleTTSChunk(text, retryCount + 1);
      }
      
      return false;
    }
  };
  
  const playBrowserTTSChunk = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      const contextSettings = getVoiceForContext('debate');
      
      utterance.rate = contextSettings.rate;
      utterance.pitch = contextSettings.pitch;
      utterance.volume = contextSettings.volume;
      
      utterance.onstart = () => {
        setIsPlaying(true);
        setIsPaused(false);
        setIsLoading(false);
      };
      
      utterance.onend = () => {
        // Only play next chunk if not manually stopped
        if (!isStopped.current) {
          playNextChunk();
        }
      };
      
      utterance.onerror = () => {
        // Only update state if not manually stopped
        if (!isStopped.current) {
          setIsPlaying(false);
          setIsPaused(false);
          setIsLoading(false);
          setCurrentChunk(0);
        }
      };
      
      utterance.onpause = () => {
        setIsPaused(true);
      };
      
      utterance.onresume = () => {
        setIsPaused(false);
      };
      
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };
  
  const playNextChunk = () => {
    const nextChunkIndex = currentChunk + 1;
    
    if (nextChunkIndex >= chunksRef.current.length) {
      // Finished all chunks
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentChunk(0);
      return;
    }
    
    setCurrentChunk(nextChunkIndex);
    
    // Brief pause between chunks
    setTimeout(() => {
      const nextChunk = chunksRef.current[nextChunkIndex];
      playChunk(nextChunk);
    }, 200);
  };
  
  const playChunk = async (text) => {
    const success = await playGoogleTTSChunk(text);
    if (!success) {
      playBrowserTTSChunk(text);
    }
  };
  
  const handlePlay = async () => {
    if (!analysisText) return;
    
    // Reset stopped flag when starting new playback
    isStopped.current = false;
    
    setIsLoading(true);
    setCurrentChunk(0);
    
    // Prepare chunks
    const fullText = `${title}. ${analysisText}`;
    const cleanText = stripMarkdown(fullText);
    const textWithPauses = addHeadingPauses(cleanText);
    chunksRef.current = chunkTextForTTS(textWithPauses);
    
    if (chunksRef.current.length === 0) {
      setIsLoading(false);
      return;
    }
    
    // Start playing first chunk
    playChunk(chunksRef.current[0]);
  };
  
  const handlePause = () => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPaused(true);
    } else if (window.speechSynthesis && isPlaying) {
      window.speechSynthesis.pause();
    }
  };
  
  const handleResume = () => {
    // Reset stopped flag when resuming
    isStopped.current = false;
    
    if (audioRef.current && isPaused) {
      audioRef.current.play();
      setIsPaused(false);
    } else if (window.speechSynthesis && isPaused) {
      window.speechSynthesis.resume();
    }
  };
  
  const handleStop = () => {
    stopFullAnalysis();
  };
  
  return (
    <div className="enhanced-analysis-tts">
      <div className="voice-output-container">
        <div className="voice-output-controls">
          {!isPlaying && !isLoading ? (
            <button
              onClick={handlePlay}
              className="voice-output-play-button voice-output-button-default"
              title="Play full analysis"
              aria-label="Play full analysis as speech"
            >
              <span className="voice-button-icon">▶️</span>
              <span className="voice-output-label">Play Full Analysis</span>
            </button>
          ) : isLoading ? (
            <button
              disabled={true}
              className="voice-output-play-button voice-output-button-default"
              title="Loading..."
              aria-label="Loading speech"
            >
              <span className="voice-button-icon">⏳</span>
              <span className="voice-output-label">Loading...</span>
            </button>
          ) : (
            <div className="voice-output-playing-controls">
              {isPaused ? (
                <button
                  onClick={handleResume}
                  className="voice-output-resume-button voice-output-button-default"
                  title="Resume full analysis"
                  aria-label="Resume full analysis speech"
                >
                  <span className="voice-button-icon">▶️</span>
                  <span className="voice-output-label">Resume</span>
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="voice-output-pause-button voice-output-button-default"
                  title="Pause full analysis"
                  aria-label="Pause full analysis speech"
                >
                  <span className="voice-button-icon">⏸️</span>
                  <span className="voice-output-label">Pause</span>
                </button>
              )}
              
              <button
                onClick={handleStop}
                className="voice-output-stop-button voice-output-button-default"
                title="Stop full analysis"
                aria-label="Stop full analysis speech"
              >
                <span className="voice-button-icon">⏹️</span>
                <span className="voice-output-label">Stop</span>
              </button>
            </div>
          )}
        </div>
        
        {/* Status Display */}
        {isPlaying && (
          <div className="voice-output-status">
            <span className="voice-output-indicator">
              🔊 {isPaused ? 'Paused' : `Playing... (Chunk ${currentChunk + 1}/${chunksRef.current.length})`}
            </span>
          </div>
        )}
        
        {/* Hidden audio element for Google TTS */}
        <audio ref={audioRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default EnhancedAnalysisTTS;
export { TTSProvider, HeaderPlayButton, useTTS };