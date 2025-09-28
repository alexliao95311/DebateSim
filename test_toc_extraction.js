#!/usr/bin/env node
/**
 * Test the TOC-first section extraction approach
 */

const fs = require('fs');

// Read the cleaned Congress text from our previous test
let testText;
try {
  testText = fs.readFileSync('./cleaned_congress_text.txt', 'utf8');
  console.log('📄 Loaded test text length:', testText.length);
} catch (error) {
  console.error('❌ Could not load cleaned_congress_text.txt');
  console.error('   Run: python test_api_text.py first to generate the test data');
  process.exit(1);
}

// Extract section list from table of contents
function extractTOCSections(text) {
  console.log('📋 Extracting sections from table of contents...');

  // Find the table of contents section
  const tocStart = text.search(/TABLE\s+OF\s+CONTENTS|CONTENTS/i);
  if (tocStart === -1) {
    console.log('❌ No table of contents found');
    return [];
  }

  // Find where the actual bill content starts (after TOC)
  // Look for the actual implementation of the first section
  const billStartMarkers = [
    /SEC\.\s+1001\.\s+[A-Z]/i,  // First real section implementation
    /SEC\.\s+1\.\s+[A-Z]/i,     // Or section 1 implementation
    /TITLE\s+[IVX]+\s*--.*SEC\.\s+\d+/i  // Title followed by section implementation
  ];

  let tocEnd = text.length;

  // Look for the start of actual bill implementation (not TOC)
  // Find the first substantial section implementation
  const sectionImplPattern = /SEC\.\s+(\d+[A-Z]?)\.\s+[A-Z][A-Z\s\-,()&.]+\.\s*\([a-z]\)/gi;
  const sectionImpl = sectionImplPattern.exec(text.substring(tocStart + 1000));

  if (sectionImpl) {
    tocEnd = tocStart + 1000 + sectionImpl.index;
    console.log('📋 Found bill implementation start at position:', tocEnd);
  } else {
    // Fallback to original markers
    for (const marker of billStartMarkers) {
      const match = text.substring(tocStart + 100).search(marker);
      if (match !== -1) {
        const actualPos = tocStart + 100 + match;
        if (actualPos < tocEnd) {
          tocEnd = actualPos;
        }
      }
    }
  }

  const tocText = text.substring(tocStart, tocEnd);
  console.log('📋 TOC text length:', tocText.length);
  console.log('📋 TOC preview:', tocText.substring(0, 500));

  // Extract section entries from TOC
  const sectionPattern = /Sec\.\s+(\d+[A-Z]?)\.\s+(.+?)(?=\n|Sec\.\s+\d+|\.|$)/gi;
  const sections = [];
  let match;

  while ((match = sectionPattern.exec(tocText)) !== null) {
    const sectionNumber = match[1].trim();
    let sectionTitle = match[2].trim();

    // Clean up the title
    sectionTitle = sectionTitle.replace(/\s+/g, ' ');
    sectionTitle = sectionTitle.replace(/\.$/, ''); // Remove trailing period

    // Skip if this looks like a page number or other non-section content
    if (sectionTitle.length < 5 || /^\d+$/.test(sectionTitle)) {
      continue;
    }

    const section = {
      number: sectionNumber,
      title: `SEC. ${sectionNumber}. ${sectionTitle.toUpperCase()}.`,
      originalTitle: sectionTitle
    };

    console.log('📋 TOC entry:', section.number, '-', section.originalTitle);
    sections.push(section);
  }

  console.log('📋 Extracted', sections.length, 'sections from TOC');
  return sections;
}

// Find a specific section in the full document text
function findSectionInText(text, tocSection, allTocSections) {
  const sectionNumber = tocSection.number;

  // Create multiple search patterns for this section
  const searchPatterns = [
    // Most common: "SEC. 1001. TITLE."
    new RegExp(`SEC\\.?\\s+${sectionNumber}\\.\\s+[A-Z][A-Z\\s\\-,()&.]+\\.`, 'gi'),
    // Alternative: "SECTION 1001. TITLE."
    new RegExp(`SECTION\\s+${sectionNumber}\\.\\s+[A-Z][A-Z\\s\\-,()&.]+\\.`, 'gi'),
    // Simple: "SEC. 1001."
    new RegExp(`SEC\\.?\\s+${sectionNumber}\\.`, 'gi'),
    // Even simpler: just the number pattern at word boundary
    new RegExp(`\\bSEC(?:TION)?\\.?\\s+${sectionNumber}\\b`, 'gi')
  ];

  let bestMatch = null;
  let bestScore = 0;

  // Try each pattern
  for (let i = 0; i < searchPatterns.length; i++) {
    const pattern = searchPatterns[i];
    const matches = [...text.matchAll(pattern)];

    for (const match of matches) {
      const position = match.index;
      const matchText = match[0];

      // Score this match based on various criteria
      let score = 0;

      // Prefer matches that are not in the TOC area (first 10% of document)
      if (position > text.length * 0.1) score += 10;

      // Prefer matches with full titles over just numbers
      if (matchText.length > 10) score += 5;

      // Prefer exact pattern matches (lower index = more specific pattern)
      score += (4 - i);

      // Check if this match has legislative content after it (subsections, amendments, etc.)
      const contentAfter = text.substring(position, position + 500);
      if (/\([a-z]\)/.test(contentAfter)) score += 5; // Has subsections
      if (/is amended|striking|inserting|adding/.test(contentAfter)) score += 3; // Legislative language

      console.log('🔍 Potential match for section', sectionNumber, 'at position', position, 'score:', score, 'text:', matchText.substring(0, 60));

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { position, matchText, score };
      }
    }
  }

  if (!bestMatch) {
    console.log('❌ No match found for section', sectionNumber);
    return null;
  }

  // Find the end of this section by looking for the next section
  const currentIndex = allTocSections.findIndex(s => s.number === sectionNumber);
  let endPosition = text.length;

  // Look for the next section in the TOC list
  for (let i = currentIndex + 1; i < allTocSections.length; i++) {
    const nextSection = allTocSections[i];
    const nextPattern = new RegExp(`SEC\\.?\\s+${nextSection.number}\\.`, 'gi');

    // Reset regex lastIndex to avoid issues
    nextPattern.lastIndex = 0;
    const nextMatch = nextPattern.exec(text.substring(bestMatch.position + 100));

    if (nextMatch) {
      endPosition = bestMatch.position + 100 + nextMatch.index;
      break;
    }
  }

  // Extract the content
  let content = text.substring(bestMatch.position, endPosition).trim();

  // Limit very long sections
  if (content.length > 15000) {
    content = content.substring(0, 15000) + '...';
  }

  console.log('✅ Extracted section', sectionNumber, 'from position', bestMatch.position, 'to', endPosition, 'length:', content.length);

  return content;
}

// Main extraction function using TOC-first approach
function extractSectionsFromText(text) {
  console.log('🔧 Starting TOC-first section extraction...');
  console.log('📊 Input text length:', text.length);

  // Step 1: Find and extract table of contents sections
  const tocSections = extractTOCSections(text);
  console.log('📋 Found', tocSections.length, 'sections in table of contents');

  if (tocSections.length === 0) {
    console.log('⚠️ No TOC found, falling back to full text as single section');
    return [{
      id: 'full-bill',
      number: 'Full Bill',
      title: 'Full Bill Text',
      type: 'full',
      content: text.substring(0, 10000) + (text.length > 10000 ? '...' : '')
    }];
  }

  // Step 2: Find each TOC section in the full document
  const sections = [];
  console.log('🔍 Searching for each TOC section in the full document...');

  for (let i = 0; i < tocSections.length; i++) {
    const tocSection = tocSections[i];
    const sectionContent = findSectionInText(text, tocSection, tocSections);

    if (sectionContent) {
      const section = {
        id: `section-${i}`,
        number: tocSection.number,
        title: tocSection.title,
        type: 'section',
        content: sectionContent
      };

      console.log('✅ Found section:', {
        number: section.number,
        title: section.title.substring(0, 60) + '...',
        contentLength: section.content.length
      });

      sections.push(section);
    } else {
      console.log('❌ Could not find content for section:', tocSection.number, tocSection.title);
    }
  }

  console.log('✅ Section extraction completed!');
  console.log('📊 Final sections count:', sections.length, 'out of', tocSections.length, 'TOC entries');

  if (sections.length > 0) {
    console.log('📏 Content length range:', {
      min: Math.min(...sections.map(s => s.content.length)),
      max: Math.max(...sections.map(s => s.content.length)),
      avg: Math.round(sections.reduce((sum, s) => sum + s.content.length, 0) / sections.length)
    });
  }

  return sections;
}

// Test the extraction
console.log('🚀 Starting TOC-first section extraction test...');
const sections = extractSectionsFromText(testText);
console.log(`\n✅ Test complete! Found ${sections.length} sections total`);

// Check for specific sections
const specificSections = ['1001', '1002', '1005', '1006', '1101', '2001', '2002', '9011', '9042', '9621'];
console.log('\n🔍 CHECKING FOR SPECIFIC SECTIONS:');
specificSections.forEach(secNum => {
  const found = sections.find(s => s.number === secNum);
  if (found) {
    console.log(`✅ Section ${secNum}: FOUND - "${found.title}" (${found.content.length} chars)`);
  } else {
    console.log(`❌ Section ${secNum}: MISSING`);
  }
});

// Show all sections found
console.log('\n📋 ALL SECTIONS FOUND:');
sections.forEach((section, i) => {
  console.log(`${(i + 1).toString().padStart(3)}. Sec ${section.number.toString().padStart(6)}: ${section.title} (${section.content.length} chars)`);
});

// Save results for analysis
const results = {
  totalSections: sections.length,
  sections: sections.map(s => ({
    number: s.number,
    title: s.title,
    contentLength: s.content.length,
    contentPreview: s.content.substring(0, 200)
  }))
};

fs.writeFileSync('toc_extraction_results.json', JSON.stringify(results, null, 2));
console.log('💾 Results saved to toc_extraction_results.json');