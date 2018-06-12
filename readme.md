# ReCaptcha Extractor and Automator

This is a Chrome Extension to automate the collection of **gCaptchaCode** strings. This should be used by **developers** that know how to make requests using cURL and where to use the **gCaptchaCode**.

This is **NOT**:

* ReCaptcha auto-click (it will not auto click in the checkbox when navigating in normal websites).
* ReCaptcha challenge solver (it will not solve the challenge when requested).

## Features

* Automator (request every X minutes).
* CAPTCHAs URLs in page ContextMenus (right click).
* Copy **gCaptchaCode** to clipboard.
* Alert *Human* to solve the challenge.
* Statistics about captchas solved / not solved.

## Known issues

On some versions of Google Chrome (mainly 67), the `onEvent` function stops receiving requests for no reason. This hurts the behaviour of the extension, because no longer catch the `userverify` or `payload` endpoints of ReCaptcha.

Until this is solved, the solution is to use a different version, like [Google Chrome Canary](https://www.google.com/chrome/browser/canary.html), unfortunately not available for Linux. For Linux you can try to check [Chromium](https://www.chromium.org/getting-involved/dev-channel).

## Recommendation

For better stealth, the hosts file of the computer that is running this extension can be modified to point to localhost.
This will not impact extraction for **gCaptchaCode**, and improve stealth.

Location for:
* Windows: `c:\Windows\System32\Drivers\etc\hosts`
* Linux/OSX: `/etc/hosts`

Example:

```
127.0.0.1   sitewithcaptcha.com
```

## How it works

This extension automates a series of functions on the Chrome browser to extract **gCaptchaCode**. By installing this extension in several computers, **gCaptchaCodes** can harvest from different computers (like a *botnet*, but please use with the *Human* consent).

This will try to solve the ReCaptcha, replacing the HTML in the page by just minimum necessary scripts and request to solve the captcha. All connections will be blocked, except for Google ReCaptcha and the first request to the site that implement ReCaptcha.

## What is gCaptchaCode ?

This is a string with different sizes (442 or 485 characters, but might be other lengths), starting with **03ACgFB9**. This string can sent to the website that implement Google ReCaptcha to access the content protected by it.

It expires in 120 seconds, so be aware that to use it as soon as possible.

## Options

This extension have an options page where some behaviour can be adjusted.

### Copy gCaptchaCode to clipboard

If an interface is developed to insert **gCaptchaCode**, this extension ca be used to solve the captcha and automatically extract **gCaptchaCode** to *Human* clipboard. This functionality probably can extend (with this source code) to improve the automated behaviour.

### Switch to a new tab to view ReCaptcha to be solved more quickly (Human only)

When the *Human* request to solve a ReCaptcha, a new tab opens with the website URL in order to extract the *gCaptchaCode*. This new tab can be an **active tab** or a **background tab**. Don't know why, but normally code run on the background tabs takes longer to solve (~50 seconds vs ~7 seconds).

### Alert Human to solve captcha, if ReCaptcha ask to solve it?

When ReCaptcha isn't automatically solved, it will ask *Human* to solve it (if this options is **enabled**). After it is solved, it will continue with the normal behaviour.

If this option isn't enable, it will close the new tab. When *Human* ask again the challenge can reappear or not.

### Send gCaptchaCode to a sinkhole on Human request?

If an interface is developed for the *Human* to insert **gCaptchaCode**, on *Human* action and if copy to clipboard is enabled, the **gCaptchaCode** will not be sent to the sinkhole. The user can use this interface to send it, mainly if the *Human* want to control some options to request.

If **enabled**, the *Human* will not have control over **gCaptchaCode**.

### Captcha URL

Captcha URLs is a list of websites to obtain **gCaptchaCode**. The information need for this setup is the main website URL (https://www.example.com) and the **site key** code available on ReCaptcha code in HTML.

### Sinkhole

Sinkholes are endpoints that are created to receive **gCaptchaCode** and use it. For each captcha URL request and solved, it will send for **all** sinkholes defined here.

### Automation

When **enabled**, it will open a new tab (on background), load the ReCaptcha script, click in it, harvest **gCaptchaCode** and send to the sinkholes defined.

The frequency that this will be done can be defined, but is recommended to be above **100** minutes.
