if (document.querySelector(".recaptcha-checkbox") != null) {
  // Need to be 1000, because if it is too short it will ask to solve a challenge.
  var delay = 1000 + Math.random() * 2000;

  setTimeout(function() {
    if (document.querySelector(".recaptcha-checkbox") != null) {
      // Click on ReCaptcha checkbox
      document.querySelector(".recaptcha-checkbox").click();
    }
  }, delay);
}
