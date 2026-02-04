/**
 * Table Operations Module
 * Check table status and extract irrigation time data
 * 
 * Handles the right panel tables showing "첫 급액 시간" and "마지막 급액 시간"
 */

import { log } from './utils.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 💧 TABLE STATUS CHECKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if irrigation time tables are already filled
 * @param {Page} page - Playwright page
 * @returns {Promise<object>} - {firstTime, lastTime, needsFirstClick, needsLastClick, debug}
 */
export async function checkTableStatus(page) {
  log('💧 Checking irrigation time tables...', 'step');
  
  try {
    const tableStatus = await page.evaluate(() => {
      const results = { debug: [] };
      
      // Target exact labels
      const firstTimeLabel = '구역 1 첫 급액 시간 1 (시분)';
      const lastTimeLabel = '구역 1 마지막 급액 시간 1 (시분)';
      
      let firstTimeValue = null;
      let lastTimeValue = null;
      
      // Strategy: Find headings with exact text, then look for input/display below
      const allElements = Array.from(document.querySelectorAll('*'));
      
      allElements.forEach(elem => {
        const text = (elem.textContent || '').trim();
        
        // Must match EXACTLY the label (to avoid picking up "진우")
        if (text.includes('첫 급액 시간') && elem.children.length === 0) {
          results.debug.push(`Found first label: ${elem.tagName}`);
          
          // Look in parent container for input or value display
          let container = elem.closest('div, section, article');
          if (container) {
            // Look for input field
            const input = container.querySelector('input[type="text"], input:not([type])');
            if (input) {
              firstTimeValue = input.value || input.placeholder;
              results.debug.push(`First value from input: "${firstTimeValue}"`);
            }
            
            // Or look for display text in sibling/child
            if (!firstTimeValue) {
              const siblings = Array.from(container.children);
              siblings.forEach(sib => {
                const sibText = sib.textContent.trim();
                if (sibText && sibText !== firstTimeLabel && sibText.length < 20) {
                  if (!firstTimeValue || sibText.includes(':')) {
                    firstTimeValue = sibText;
                    results.debug.push(`First value from sibling: "${sibText}"`);
                  }
                }
              });
            }
          }
        }
        
        if (text.includes('마지막 급액 시간') && elem.children.length === 0) {
          results.debug.push(`Found last label: ${elem.tagName}`);
          
          let container = elem.closest('div, section, article');
          if (container) {
            const input = container.querySelector('input[type="text"], input:not([type])');
            if (input) {
              lastTimeValue = input.value || input.placeholder;
              results.debug.push(`Last value from input: "${lastTimeValue}"`);
            }
            
            if (!lastTimeValue) {
              const siblings = Array.from(container.children);
              siblings.forEach(sib => {
                const sibText = sib.textContent.trim();
                if (sibText && sibText !== lastTimeLabel && sibText.length < 20) {
                  if (!lastTimeValue || sibText.includes(':')) {
                    lastTimeValue = sibText;
                    results.debug.push(`Last value from sibling: "${sibText}"`);
                  }
                }
              });
            }
          }
        }
      });
      
      // Clean up values - remove the label text if it got included
      if (firstTimeValue && firstTimeValue.includes(firstTimeLabel)) {
        firstTimeValue = firstTimeValue.replace(firstTimeLabel, '').trim();
      }
      if (lastTimeValue && lastTimeValue.includes(lastTimeLabel)) {
        lastTimeValue = lastTimeValue.replace(lastTimeLabel, '').trim();
      }
      
      return {
        firstTime: firstTimeValue,
        lastTime: lastTimeValue,
        needsFirstClick: !firstTimeValue || firstTimeValue === '' || firstTimeValue === '-' || firstTimeValue === '--:--' || firstTimeValue.includes('클릭'),
        needsLastClick: !lastTimeValue || lastTimeValue === '' || lastTimeValue === '-' || lastTimeValue === '--:--' || lastTimeValue.includes('클릭'),
        debug: results.debug
      };
    });
    
    log(`   → 첫 급액시간: "${tableStatus.firstTime || 'EMPTY'}"`, 'info');
    log(`   → 마지막 급액시간: "${tableStatus.lastTime || 'EMPTY'}"`, 'info');
    log(`   → Needs first click: ${tableStatus.needsFirstClick}`, 'info');
    log(`   → Needs last click: ${tableStatus.needsLastClick}`, 'info');
    
    return tableStatus;
    
  } catch (error) {
    log(`Error checking table status: ${error.message}`, 'error');
    return {
      firstTime: null,
      lastTime: null,
      needsFirstClick: true,
      needsLastClick: true,
      debug: [],
      error: error.message
    };
  }
}

/**
 * Extract irrigation time data from tables
 * @param {Page} page - Playwright page
 * @returns {Promise<object>} - {firstIrrigationTime, lastIrrigationTime, debug}
 */
export async function extractIrrigationTimes(page) {
  log('📊 Extracting irrigation data from tables...', 'step');
  
  try {
    const finalData = await page.evaluate(() => {
      const results = {
        firstIrrigationTime: null,
        lastIrrigationTime: null,
        debug: []
      };
      
      console.log('📊 [BROWSER] Extracting irrigation time data from tables...');
      
      // Strategy 1: Look for time input fields (type="time")
      const timeInputs = Array.from(document.querySelectorAll('input[type="time"]'));
      results.debug.push(`Found ${timeInputs.length} time input fields`);
      console.log(`📊 [BROWSER] Found ${timeInputs.length} time input fields`);
      
      // For each time input, look backwards in the DOM to find its label
      timeInputs.forEach((input, idx) => {
        const value = input.value;
        results.debug.push(`Time input ${idx + 1}: value="${value || 'EMPTY'}"`);
        
        // Find the parent container
        let container = input.closest('div');
        if (container) {
          // Look for text content in the same container or its siblings
          const containerText = container.textContent || '';
          results.debug.push(`Container text: "${containerText.substring(0, 50)}..."`);
          
          // Check if this is the "first irrigation time" field
          if (containerText.includes('첫 급액') || containerText.includes('첫급액')) {
            results.firstIrrigationTime = value;
            results.debug.push(`✅ Matched FIRST time: "${value}"`);
            console.log(`✅ [BROWSER] Found FIRST irrigation time: "${value}"`);
          }
          // Check if this is the "last irrigation time" field
          else if (containerText.includes('마지막 급액') || containerText.includes('마지막급액')) {
            results.lastIrrigationTime = value;
            results.debug.push(`✅ Matched LAST time: "${value}"`);
            console.log(`✅ [BROWSER] Found LAST irrigation time: "${value}"`);
          }
        }
      });
      
      // If still not found, fallback to generic search
      if (!results.firstIrrigationTime || !results.lastIrrigationTime) {
        results.debug.push('Trying fallback strategy...');
        // Strategy 2: Look for table cells with time format
        const allText = Array.from(document.querySelectorAll('td, div, span, p'));
        allText.forEach((elem, idx) => {
          const text = elem.textContent.trim();
          
          // If we find the label
          if (text.includes('구역 1 첫 급액') && text.includes('시간')) {
            results.debug.push(`Found first label: "${text}"`);
            
            // Look in siblings, parent, or nearby elements
            const parent = elem.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children);
              siblings.forEach(sib => {
                const sibText = sib.textContent.trim();
                if (sibText.match(/\d{2}:\d{2}/) && !sibText.includes('급액')) {
                  results.firstIrrigationTime = sibText;
                  results.debug.push(`Found first time in sibling: "${sibText}"`);
                }
              });
            }
            
            // Try next element
            const next = allText[idx + 1];
            if (next && next.textContent.match(/\d{2}:\d{2}/)) {
              results.firstIrrigationTime = next.textContent.trim();
              results.debug.push(`Found first time in next element: "${next.textContent.trim()}"`);
            }
          }
          
          if (text.includes('구역 1 마지막 급액') && text.includes('시간')) {
            results.debug.push(`Found last label: "${text}"`);
            
            const parent = elem.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children);
              siblings.forEach(sib => {
                const sibText = sib.textContent.trim();
                if (sibText.match(/\d{2}:\d{2}/) && !sibText.includes('급액')) {
                  results.lastIrrigationTime = sibText;
                  results.debug.push(`Found last time in sibling: "${sibText}"`);
                }
              });
            }
            
            const next = allText[idx + 1];
            if (next && next.textContent.match(/\d{2}:\d{2}/)) {
              results.lastIrrigationTime = next.textContent.trim();
              results.debug.push(`Found last time in next element: "${next.textContent.trim()}"`);
            }
          }
        });
        
        // Strategy 3: If still not found, look for ANY elements with time format
        if (!results.firstIrrigationTime || !results.lastIrrigationTime) {
          const timeElements = allText.filter(elem => {
            const text = elem.textContent.trim();
            return text.match(/^\d{2}:\d{2}$/);
          });
          
          results.debug.push(`Found ${timeElements.length} elements with time format`);
          
          if (timeElements.length >= 2) {
            // Assume first time-format element is "첫 급액시간"
            if (!results.firstIrrigationTime) {
              results.firstIrrigationTime = timeElements[0].textContent.trim();
              results.debug.push(`Using first time element: "${results.firstIrrigationTime}"`);
            }
            // Assume last time-format element is "마지막 급액시간"
            if (!results.lastIrrigationTime) {
              results.lastIrrigationTime = timeElements[timeElements.length - 1].textContent.trim();
              results.debug.push(`Using last time element: "${results.lastIrrigationTime}"`);
            }
          }
        }
      }
      
      console.log('📋 [BROWSER] Extraction complete:');
      console.log(`   → First time: ${results.firstIrrigationTime || 'NOT FOUND'}`);
      console.log(`   → Last time: ${results.lastIrrigationTime || 'NOT FOUND'}`);
      
      return results;
    });
    
    log(`   → 첫 급액시간 1: ${finalData.firstIrrigationTime || 'NOT FOUND'}`, 'info');
    log(`   → 마지막 급액시간 1: ${finalData.lastIrrigationTime || 'NOT FOUND'}`, 'info');
    
    return finalData;
    
  } catch (error) {
    log(`Error extracting irrigation times: ${error.message}`, 'error');
    return {
      firstIrrigationTime: null,
      lastIrrigationTime: null,
      debug: [],
      error: error.message
    };
  }
}

/**
 * Validate irrigation time format (HH:MM)
 * @param {string} timeString - Time string to validate
 * @returns {boolean}
 */
export function validateTimeFormat(timeString) {
  if (!timeString) return false;
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeString);
}
