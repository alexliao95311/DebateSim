#!/usr/bin/env node
/**
 * Find where the real sections are located in the text (not TOC)
 */

const fs = require('fs');

let testText;
try {
  testText = fs.readFileSync('./cleaned_congress_text.txt', 'utf8');
  console.log('📄 Loaded test text length:', testText.length);
} catch (error) {
  console.error('❌ Could not load cleaned_congress_text.txt');
  process.exit(1);
}

// Let's search for specific sections to see where they actually are
const sectionsToFind = ['10101', '70102', '70101'];

console.log('🔍 Searching for specific sections in the text...\n');

sectionsToFind.forEach(secNum => {
  console.log(`\n=== SEARCHING FOR SECTION ${secNum} ===`);

  // Look for different patterns
  const patterns = [
    new RegExp(`SEC\\.?\\s+${secNum}\\.?\\s+[A-Z][A-Z\\s\\-,()]+\\.`, 'gi'),
    new RegExp(`SECTION\\s+${secNum}\\.?\\s+[A-Z][A-Z\\s\\-,()]+\\.`, 'gi'),
    new RegExp(`Sec\\.?\\s+${secNum}\\.?\\s+`, 'gi'),
    new RegExp(`SEC\\.?\\s+${secNum}\\b`, 'gi'),
  ];

  patterns.forEach((pattern, i) => {
    const matches = [...testText.matchAll(pattern)];
    console.log(`Pattern ${i + 1}: Found ${matches.length} matches`);

    matches.forEach((match, j) => {
      const position = match.index;
      const positionPercent = Math.round((position / testText.length) * 100);
      const start = Math.max(0, position - 100);
      const end = Math.min(testText.length, position + 500);
      const context = testText.substring(start, end);

      console.log(`  Match ${j + 1}: pos ${position} (${positionPercent}%)`);
      console.log(`    Text: "${match[0]}"`);
      console.log(`    Context: ...${context}...`);
      console.log(`    Content after: "${testText.substring(position + match[0].length, position + match[0].length + 100)}"`);
      console.log('');
    });
  });
});

// Let's also look for the general pattern of actual sections (ALL CAPS with content)
console.log('\n=== SEARCHING FOR GENERAL SECTION PATTERNS ===');

// Look for sections that have real content (parentheses, amendments, etc.)
const realSectionPattern = /SEC\.\s+\d+[A-Z]?\.\s+[A-Z][A-Z\s\-,()]+\.\s*\([a-z]\)/gi;
const matches = [...testText.matchAll(realSectionPattern)];

console.log(`Found ${matches.length} sections with real content (containing subsections):`);

matches.slice(0, 10).forEach((match, i) => {
  const position = match.index;
  const positionPercent = Math.round((position / testText.length) * 100);
  const contentAfter = testText.substring(position + match[0].length, position + match[0].length + 200);

  console.log(`${i + 1}. pos ${position} (${positionPercent}%): ${match[0]}`);
  console.log(`   Content: ${contentAfter.substring(0, 100)}...`);
});

// Let's look at the document structure - where does the TOC end and real content begin?
console.log('\n=== DOCUMENT STRUCTURE ANALYSIS ===');

const tocEndMarkers = [
  'Be it enacted by the Senate',
  'enacted by the Senate and House',
  'TABLE OF CONTENTS',
  'TITLE I--',
  'Subtitle A--'
];

tocEndMarkers.forEach(marker => {
  const index = testText.indexOf(marker);
  if (index !== -1) {
    const percent = Math.round((index / testText.length) * 100);
    console.log(`"${marker}" found at position ${index} (${percent}%)`);
  }
});

// Look for the actual start of legislative content
const legislativeMarkers = [
  /\([a-z]\)\s+In General\.--/gi,
  /\([a-z]\)\s+[A-Z][^.]+\.--/gi,
  /Section\s+\d+[A-Z]?\s+of\s+the/gi,
  /is amended by/gi,
  /striking subsection/gi
];

console.log('\n=== LEGISLATIVE CONTENT MARKERS ===');

legislativeMarkers.forEach((pattern, i) => {
  const matches = [...testText.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}: "${pattern}" - ${matches.length} matches`);
    matches.slice(0, 3).forEach((match, j) => {
      const position = match.index;
      const percent = Math.round((position / testText.length) * 100);
      console.log(`  Match ${j + 1}: pos ${position} (${percent}%) - "${match[0]}"`);
    });
  }
});