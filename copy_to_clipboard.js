/**
 * Script to copy text to clipboard.
 */

// Create HTML node textarea with the string we want to copy
var copyFrom = document.createElement("textarea");
copyFrom.style.opacity = 0;
copyFrom.textContent = captcha;
document.body.appendChild(copyFrom);

// Select all text
copyFrom.focus();
document.execCommand('SelectAll');

// Copy to clipboard
document.execCommand('Copy');

// Remove HTML node
document.body.removeChild(copyFrom);
