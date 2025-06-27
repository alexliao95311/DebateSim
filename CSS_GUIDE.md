# DebateSim CSS Organization Guide

## File Structure & Responsibilities

### 1. **index.css** - Global Base Styles
- Root variables and global defaults
- Basic HTML element styling (buttons, inputs, etc.)
- Should NOT contain component-specific rules

### 2. **Component CSS Files**
Each component has its own CSS file with clear boundaries:

#### **Debate.css**
- **Scope**: Main debate interface
- **Key Areas**:
  - Background image layouts
  - Sidebar navigation
  - Speech blocks
  - Model selection dropdowns
  - Setup modals (AI vs User, User vs User)

#### **Judge.css** 
- **Scope**: Judge feedback page
- **Key Areas**:
  - Two-column transcript/feedback layout
  - Speech block styling for judge view
  - Button groups

#### **LoadingSpinner.css**
- **Scope**: Loading states across all components
- **Key Areas**:
  - Spinner animations
  - Progress indicators
  - Tip messages
  - **NOTE**: Uses `!important` for text colors to override any global conflicts

#### **Home.css**, **Login.css**, **DebateSim.css**, **Legislation.css**
- Component-specific styling for their respective pages

## Text Color Hierarchy (Debate.css)

### 1. Background Image Areas
- **Elements**: Main headers, model selection labels
- **Style**: White text with dark shadow
- **Classes**: `.debate-topic-header`, `.model-selection label`

### 2. White/Light Card Backgrounds  
- **Elements**: Speech blocks, bill descriptions
- **Style**: Dark text, no shadow
- **Classes**: `.speech-block`, `.description-content`

### 3. Setup Modals
- **Elements**: Modal headers, form labels
- **Style**: White text with shadow on dark semi-transparent background
- **Classes**: `.ai-vs-user-setup`, `.order-selection`

### 4. Sidebar
- **Elements**: Navigation items
- **Style**: Dark text on white background
- **Classes**: `.sidebar h3`, `.sidebar li`

### 5. Speech Content
- **Elements**: Markdown-rendered debate content
- **Style**: Dark text for readability
- **Classes**: `.speech-content`

## Best Practices

### ✅ DO
- Use component-specific class names
- Group related styles together
- Use semantic naming (`.speech-block` not `.blue-box`)
- Comment complex sections
- Use CSS custom properties for colors/spacing

### ❌ DON'T  
- Use global selectors that affect multiple components
- Override styles with `!important` unless absolutely necessary (LoadingSpinner exception)
- Create conflicting rules between components
- Use inline styles in JSX (except for dynamic values)

## Debugging Text Visibility Issues

1. **Check component hierarchy**: Which CSS file should handle the styling?
2. **Verify background context**: Is text on dark or light background?
3. **Use browser dev tools**: Check what styles are being applied/overridden
4. **Follow the text color hierarchy**: Match the appropriate section above

## Making Changes

- **Layout changes**: Edit the specific component's CSS file
- **Color scheme**: Update CSS custom properties in index.css or component files
- **Cross-component styling**: Consider if it belongs in index.css or needs component isolation
- **Loading states**: Modify LoadingSpinner.css

## Emergency Fixes

If text becomes invisible:
1. Check the Text Color Hierarchy section above
2. Add appropriate color rules to the component's CSS file  
3. Avoid using `!important` unless dealing with LoadingSpinner
4. Test in different contexts (background image, white cards, modals)