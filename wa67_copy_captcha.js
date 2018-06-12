var textarea = document.getElementsByTagName("textarea");
if (textarea.length > 0) {
  document.getElementsByTagName("textarea")[0].focus();
  document.execCommand('SelectAll');
  document.execCommand('Copy');
}
