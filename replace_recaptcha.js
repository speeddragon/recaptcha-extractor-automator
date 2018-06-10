/**
 * Replace HTML with ReCaptcha script.
 */

// Load ReCaptcha script
var head = document.getElementsByTagName('head')[0];
var script= document.createElement('script');
script.type= 'text/javascript';
script.src= 'https://www.google.com/recaptcha/api.js?hl=en';
head.appendChild(script);

var body = document.getElementsByTagName('body')[0];

// Clear all DIVs
while (body.firstChild) {
    body.removeChild(body.firstChild);
}

// Add DIV to click
var div = document.createElement("div");
div.setAttribute("style", "float:left;");
div.setAttribute("class", "g-recaptcha");
div.setAttribute("data-sitekey", site_key);
body.appendChild(div);
