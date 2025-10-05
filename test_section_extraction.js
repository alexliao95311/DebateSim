#!/usr/bin/env node
/**
 * Dedicated section extraction tester for Congress bills
 * Tests the exact same logic as the frontend uses
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

// Replicate the exact frontend logic
function extractSectionsFromText(text) {
  console.log('🔧 extractSectionsFromText called');
  console.log('📊 Input text type:', typeof text);
  console.log('📊 Input text length:', text?.length || 0);
  console.log('📊 Input text preview:', text.substring(0, 100));

  if (!text) {
    console.log('⚠️ No text provided to extractSectionsFromText');
    return [];
  }

  if (typeof text !== 'string') {
    console.error('❌ Text is not a string, type:', typeof text, 'value:', text);
    return [];
  }

  const sections = [];

  console.log('🔍 Starting section extraction...');
  console.log('📄 Text sample (first 500 chars):', text.substring(0, 500));

  // Text format analysis
  console.log('🔍 Text format analysis:', {
    hasNewlines: text.includes('\n'),
    lineCount: text.split('\n').length,
    firstChars: text.substring(0, 200)
  });

  let headerPattern;
  let isLineBased = text.includes('\n') && text.split('\n').length > 50;

  if (isLineBased) {
    console.log('📄 Using line-based pattern for PDF text');
    headerPattern = /(?:^|\n)\s*(SEC(?:TION)?\.?\s+\d+[A-Z]?\.?\s*[^\n]*)/gim;
  } else {
    console.log('🌐 Using continuous text pattern for Congress API');
    // Match actual section headers (ALL CAPS) that contain real legislative content
    headerPattern = /\b(SEC\.?\s+\d+[A-Z]?\.?\s+[A-Z][A-Z\s\-,()&]+\.)\s*\([a-z]\)/gim;
  }

  const matches = [];
  let match;
  while ((match = headerPattern.exec(text)) !== null) {
    const headerText = match[1] ? match[1].trim() : match[0].trim();

    // For line-based text, we need to find the actual start of the header
    let actualIndex = match.index;
    if (isLineBased && match[1]) {
      actualIndex = match.index + match[0].indexOf(match[1]);
    }

    matches.push({
      index: actualIndex,
      headerText: headerText,
      fullMatch: match[0]
    });
  }

  console.log('🎯 Found', matches.length, 'potential section markers');
  console.log('📍 First 20 section markers:');
  matches.slice(0, 20).forEach((m, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. pos ${m.index.toString().padStart(6)}: ${m.headerText}`);
  });

  if (matches.length === 0) {
    console.log('⚠️ No section markers found, creating single section');
    sections.push({
      id: 'full-bill',
      number: 'Full Bill',
      title: 'Full Bill',
      type: 'full',
      content: text.substring(0, 10000) + '...'
    });
  } else {
    // Create sections based on the matches
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const nextMatch = matches[i + 1];

      // Extract section number and title from header
      const numberMatch = match.headerText.match(/(\d+[A-Z]?)/i);
      const sectionNumber = numberMatch ? numberMatch[1] : (i + 1).toString();

      const sectionType = 'section';

      // Get content from current section header to next section header (or end of text)
      const startIndex = match.index;
      const endIndex = nextMatch ? nextMatch.index : text.length;
      let sectionContent = text.substring(startIndex, endIndex).trim();

      // For very long sections, limit to a reasonable length
      if (sectionContent.length > 10000) {
        sectionContent = sectionContent.substring(0, 10000) + '...';
      }

      console.log('📏 Content extraction debug:', {
        sectionNumber,
        startIndex,
        endIndex,
        contentLength: sectionContent.length,
        contentPreview: sectionContent.substring(0, 200),
        rawSlice: text.substring(startIndex, Math.min(startIndex + 300, text.length))
      });

      // Use the header text directly as the title
      let title = match.headerText.trim();
      title = title.replace(/\s+/g, ' ').trim();

      console.log('📝 Section title extracted:', {
        sectionNumber,
        title,
        headerText: match.headerText
      });

      // Skip table of contents sections
      if (/table\s+of\s+contents/i.test(title)) {
        console.log('📋 Skipping table of contents section:', title);
        continue;
      }

      // With our improved pattern, we should now be getting real sections
      // Add a simple check to ensure we have substantial content
      const documentPosition = match.index / text.length;
      console.log('🔍 Section analysis for:', title, {
        documentPosition: Math.round(documentPosition * 100) + '%',
        contentLength: sectionContent.length,
        contentPreview: sectionContent.substring(0, 100) + '...'
      });

      // Since we're now targeting real sections, minimal filtering needed
      if (sectionContent.length < 200) {
        console.log('📋 Skipping short section (likely incomplete):', title);
        continue;
      }

      // Check for duplicates
      const isDuplicate = sections.some(existing => existing.number === sectionNumber);
      if (isDuplicate) {
        console.log('🔄 Skipping duplicate section:', title);
        continue;
      }

      // Create the section object
      const sectionObject = {
        id: `section-${sections.length}`,
        number: sectionNumber,
        title: title,
        type: sectionType,
        content: sectionContent
      };

      console.log('🆕 Created section:', {
        number: sectionNumber,
        type: sectionType,
        title: title,
        titleLength: title.length,
        contentLength: sectionContent.length,
        contentPreview: sectionContent.substring(0, 150) + '...'
      });

      sections.push(sectionObject);
    }
  }

  console.log('📊 Initial extraction complete. Found', sections.length, 'sections');

  // Post-processing analysis
  if (sections.length > 0) {
    const sortedByLength = [...sections].sort((a, b) => b.content.length - a.content.length);
    console.log('📊 Section length analysis:', {
      total: sections.length,
      longest: sortedByLength[0]?.content.length || 0,
      shortest: sortedByLength[sortedByLength.length - 1]?.content.length || 0,
      avgLength: Math.round(sections.reduce((sum, s) => sum + s.content.length, 0) / sections.length),
      substantialSections: sections.filter(s => s.content.length > 500).length
    });

    // Show all sections found
    console.log('\n📋 ALL SECTIONS FOUND:');
    sections.forEach((section, i) => {
      console.log(`${(i + 1).toString().padStart(3)}. Sec ${section.number.toString().padStart(6)}: ${section.title} (${section.content.length} chars)`);
    });

    // Check for specific sections mentioned by user (H.R. 1319 sections)
    const specificSections = ['1001', '1002', '1005', '1006', '1101', '2001', '2002', '9011', '9042', '9601', '9621'];
    console.log('\n🔍 CHECKING FOR SPECIFIC SECTIONS:');
    specificSections.forEach(secNum => {
      const found = sections.find(s => s.number === secNum);
      if (found) {
        console.log(`✅ Section ${secNum}: FOUND - "${found.title}" (${found.content.length} chars)`);
      } else {
        console.log(`❌ Section ${secNum}: MISSING`);
      }
    });
  }

  return sections;
}

// Test the extraction
console.log('🚀 Starting section extraction test...');
const sections = extractSectionsFromText(testText);
console.log(`\n✅ Test complete! Found ${sections.length} sections total`);

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

fs.writeFileSync('section_extraction_results.json', JSON.stringify(results, null, 2));
console.log('💾 Results saved to section_extraction_results.json');