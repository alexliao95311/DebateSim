import mammoth from 'mammoth';

// Dynamically import PDF.js to avoid initial loading issues
let pdfjsLib = null;

const initPdfjs = async () => {
  if (!pdfjsLib) {
    try {
      pdfjsLib = await import('pdfjs-dist');
      // Try to set worker source, fallback if it fails
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
      } catch (e) {
        // If worker fails, PDF.js will use fallback mode
        console.warn('PDF.js worker setup failed, using fallback mode');
      }
    } catch (error) {
      throw new Error('Failed to load PDF processing library');
    }
  }
  return pdfjsLib;
};

/**
 * Extract text from various file types
 * @param {File} file - The file to process
 * @returns {Promise<string>} - Extracted text content
 */
export const extractTextFromFile = async (file) => {
  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  
  try {
    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      return await extractTextFromTxt(file);
    } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return await extractTextFromPdf(file);
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      return await extractTextFromDocx(file);
    } else if (fileType === 'application/msword' || fileName.endsWith('.doc')) {
      throw new Error('Legacy .doc files are not supported. Please convert to .docx format.');
    } else {
      throw new Error('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
    }
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw error;
  }
};

/**
 * Extract text from TXT files
 * @param {File} file - The TXT file
 * @returns {Promise<string>} - Text content
 */
const extractTextFromTxt = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        if (!text || text.trim().length === 0) {
          reject(new Error('The text file appears to be empty.'));
        } else {
          resolve(text.trim());
        }
      } catch (error) {
        reject(new Error('Failed to read text file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read text file.'));
    reader.readAsText(file);
  });
};

/**
 * Extract text from PDF files using PDF.js
 * @param {File} file - The PDF file
 * @returns {Promise<string>} - Extracted text content
 */
const extractTextFromPdf = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const pdfjs = await initPdfjs();
        const arrayBuffer = e.target.result;
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        const numPages = pdf.numPages;
        
        // Process each page
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Extract text from text items
          const pageText = textContent.items
            .filter(item => item.str && item.str.trim().length > 0)
            .map(item => item.str)
            .join(' ');
          
          if (pageText.trim()) {
            fullText += pageText + '\n\n';
          }
        }
        
        if (!fullText || fullText.trim().length === 0) {
          reject(new Error('No readable text found in the PDF. The PDF may contain only images or be password protected.'));
        } else {
          resolve(fullText.trim());
        }
      } catch (error) {
        console.error('PDF processing error:', error);
        reject(new Error('Failed to extract text from PDF. The file may be corrupted or password protected.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read PDF file.'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Extract text from DOCX files using Mammoth.js
 * @param {File} file - The DOCX file
 * @returns {Promise<string>} - Extracted text content
 */
const extractTextFromDocx = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const result = await mammoth.extractRawText({ arrayBuffer });
        
        if (!result.value || result.value.trim().length === 0) {
          reject(new Error('No readable text found in the DOCX file.'));
        } else {
          // Log any warnings from mammoth
          if (result.messages && result.messages.length > 0) {
            console.warn('DOCX processing warnings:', result.messages);
          }
          resolve(result.value.trim());
        }
      } catch (error) {
        console.error('DOCX processing error:', error);
        reject(new Error('Failed to extract text from DOCX file. The file may be corrupted.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read DOCX file.'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Validate file before processing
 * @param {File} file - The file to validate
 * @returns {Object} - Validation result with isValid boolean and error message
 */
export const validateFile = (file) => {
  const maxSize = 10 * 1024 * 1024; // 10MB limit
  const allowedTypes = [
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];
  
  const allowedExtensions = ['.txt', '.pdf', '.docx', '.doc'];
  const fileName = file.name.toLowerCase();
  
  // Check file size
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'File size must be less than 10MB.'
    };
  }
  
  // Check file type
  const hasValidType = allowedTypes.includes(file.type.toLowerCase());
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
  
  if (!hasValidType && !hasValidExtension) {
    return {
      isValid: false,
      error: 'Only PDF, DOCX, and TXT files are supported.'
    };
  }
  
  // Special check for .doc files
  if (fileName.endsWith('.doc') && !fileName.endsWith('.docx')) {
    return {
      isValid: false,
      error: 'Legacy .doc files are not supported. Please convert to .docx format.'
    };
  }
  
  return {
    isValid: true,
    error: null
  };
};

/**
 * Format extracted text for better display
 * @param {string} text - Raw extracted text
 * @returns {string} - Formatted text
 */
export const formatExtractedText = (text) => {
  if (!text) return '';
  
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove multiple consecutive line breaks
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // Trim the text
    .trim();
};