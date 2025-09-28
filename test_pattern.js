// Test the updated section pattern
const testText = `SECTION 1. TABLE OF CONTENTS. The table of contents of this Act is as follows: Sec. 1. Table of contents. TITLE I--COMMITTEE ON AGRICULTURE, NUTRITION, AND FORESTRY Subtitle A--Nutrition Sec. 10101. Re-evaluation of thrifty food plan. Sec. 10102. Modifications to SNAP work requirements for able-bodied adults. SEC. 10101. RE-EVALUATION OF THRIFTY FOOD PLAN. (a) In General.--Section 3 of the Food and Nutrition Act of 2008 (7 U.S.C. 2012) is amended by striking subsection (u) and inserting the following: (u) Thrifty Food Plan-- (1) In general.--The term thrifty food plan means the cost of a nutritious, practical, cost-effective diet determined by the Secretary based on a re-evaluation under this paragraph. SEC. 10102. MODIFICATIONS TO SNAP WORK REQUIREMENTS FOR ABLE-BODIED ADULTS. Section 6(o) of the Food and Nutrition Act of 2008 is amended--`;

// Test patterns
const patterns = [
  { name: 'Original', regex: /(SEC(?:TION)?\.?\s+\d+[A-Z]?\.?\s*[^.]*?\.)/gim },
  { name: 'All caps only', regex: /\b(SEC(?:TION)?\.?\s+\d+[A-Z]?\.?\s+[A-Z][A-Z\s\-,]+\.)/gim },
  { name: 'Strict all caps', regex: /\b(SEC\.?\s+\d+[A-Z]?\.?\s+[A-Z][A-Z\s\-,()]+\.)/gim }
];

patterns.forEach(pattern => {
  console.log(`\n=== ${pattern.name} Pattern ===`);
  pattern.regex.lastIndex = 0; // Reset regex
  let match;
  let count = 0;
  while ((match = pattern.regex.exec(testText)) !== null && count < 10) {
    count++;
    console.log(`${count}. "${match[1]}" at position ${match.index}`);
  }
});