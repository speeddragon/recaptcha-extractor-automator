/**
 * Running on background
 */

/**
 * New tab that containt the new windows with ReCaptcha
 * @var openedTabId integer
 */
var openedTabId = null;

/**
 * Original windows that Human was
 * @var redirectToTabId integer
 */
var redirectToTabId = null;

var settings, stats, guid;
var global_wa67_iterator = 0;

// Avoid duplicates on some edge cases
var request_sent = false;

// ReCaptcha URL (aka Referrer URL)
var global_captcha_url;

// Benchmark (time)
var start_resolve_time = null;
var end_resolve_time = null;

// Automator
var last_request_timestamp = Date.now() - 24*60*60*1000; // Set timestamp 24h before
var global_human_click, automator_url_iterator = 0;
var human_solve_interaction = false, challenge_requested = false;

/**
 * Generate an unique identifier
 */
function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

/**
 * Validate and send to the sinkholes
 * @var captcha string Captcha code
 */
function validate_and_send_to_sinkholes(captcha) {
  console.log(" :: gCaptchaResponse [" + captcha + "]");

  // Update Stats
  if (!human_solve_interaction) {
    stats.requests_without_challange = stats.requests_without_challange + 1;
    stats.solved_in_a_row = stats.solved_in_a_row + 1;

    chrome.storage.sync.set({'stats': stats});
  }

  /*
    When to send to sinkholes:
    - It was run by automator.
    - When human requested, and sinkhole is enabled.
    - When human requested, and copy to clipboard is disabled
  */
  if (!global_human_click
    || (global_human_click && settings.sinkhole_on_manual_request)
    || (global_human_click && !settings.captcha_code_clipboard)) {

    send_to_sinkholes(global_captcha_url, captcha);
  }
}

/**
 * Send information to Sinkhole
 * @var referrer_url string URL where captcha can be used on
 * @var captcha string Captcha Code
 */
function send_to_sinkholes(referrer_url, captcha) {
  if (!request_sent) {
    settings.sinkholes_urls.forEach(function(sinkhole_url) {
      create_request(sinkhole_url, captcha, referrer_url);
    });

    request_sent = true;
  }
}

/**
 * XML HTTP Request
 *
 * @var url string URL
 * @var captcha string google recaptcha code
 * @var referrer_url string URl where the captcha was obtained
 */
function create_request(url, captcha, referrer_url) {
  var post = "gCaptchaCode=" + captcha + "&referrer_url=" + referrer_url + "&guid=" + guid;

  var request = new XMLHttpRequest();
  request.open("POST", url, true);
  request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  request.onreadystatechange = function() {//Call a function when the state changes.
    if(request.readyState == XMLHttpRequest.DONE && request.status == 200) {
      // Request finished. Do processing here.
      console.log("Request sent! Referrer: [" + referrer_url + "] | Sinkhole: [" + url + "]");
    }
  }

  request.send(post);
}

chrome.webRequest.onBeforeRequest.addListener(function(data) {
  if (data.tabId == openedTabId) {
    // Allow ReCaptcha API requests
    if (data.url.indexOf("://www.google.com/recaptcha/") > -1
      || data.url.indexOf("://www.gstatic.com/recaptcha/") > -1
        || data.url.indexOf("://www.google.com/js/") > -1) {

      if (data.url.indexOf("https://www.google.com/recaptcha/api2/payload?c=") > -1) {
        challenge_request_procedure({tabId: openedTabId});
      }

      console.log("Allow: " + data.url);
      return {cancel: false};
    }

    // Only affect URL inside the opened tab
    if (get_captch_url_by_url(data.url) !== false) {
      console.log("Allow: " + data.url);
      return {cancel: false};
    }

    console.log("Blocked: " + data.url);
    return {cancel: true};
  }
},{'urls': ["*://*/*"]}, ["blocking"]);

chrome.webRequest.onCompleted.addListener(function(details) {
  if (openedTabId !== details.tabId)
    return;

  var captcha_url = get_captch_url_by_url(details.url);

  if (captcha_url !== false) {
    // Replace HTML to only contain ReCaptcha, and click on it
    replace_html_and_click(captcha_url, details.url, details.tabId);
  } else if (details.url.indexOf("https://www.google.com/recaptcha/api2/userverify?k=") > -1) {
    // Request BODY of captcha successful request (NOT WORKING)
    //request_captcha_body({tabId: details.tabId}, details.requestId);
  } else if (details.url.includes("https://www.google.com/recaptcha/api2/bframe")) {
    // This alternative to CLICK works better.
    console.log(new Date() + " :: Click! (Alternative)");
    perform_click(details.tabId);
  }
},{'urls': ["*://*/*"]}, ["responseHeaders"]);

/**
 * Replace HTML and Click on ReCaptcha
 *
 * @var captcha_url object {insert_url: ..., site_key: ...}
 * @var url string URL
 * @var tabId integer Tab ID
 */
function replace_html_and_click(captcha_url, url, tabId) {
  global_captcha_url = url;

  setTimeout(function() {
    console.log(new Date() + " :: Replace HTML!");
    chrome.tabs.executeScript(tabId,
      {code: "var site_key = \"" + captcha_url.site_key + "\";" },
        function() {
          chrome.tabs.executeScript(tabId,
            {runAt: "document_end", file: "replace_recaptcha.js"});
    });

    start_resolve_time = Date.now();

    console.log(new Date() + " :: Click!");
    perform_click(tabId);
  }, 1000);
}

/**
 * Perform click action on checkbox recaptcha
 * @var $tabId string Tab ID
 */
function perform_click(tabId) {
  setTimeout(function() {
    chrome.tabs.executeScript(tabId,
      {allFrames: true, runAt: "document_end", file: "recaptcha_click.js"}, function() {
        // Workaround for Chrome version 67

        // Run every 1000 ms to check if is solved
        setTimeout(function() {
          if (global_wa67_iterator == 0) {
            check_solved_workaround({tabId: tabId});
          }
        }, 1000);
      });
  }, 2000);
}

/**
 * Clean https:// and https:// and the last slash from URL for better efficiency
 * on blocking the right URL requests.
 *
 * @var url string URL
 */
function clean_url(url) {
  url = url.replace("http://", "").replace("https://", "");
  if (url.substr(-1) == "/") {
    url = url.substr(0, url.length - 1);
  }

  return url;
}

/**
 * Retrieve CAPTCHA URL by URL
 *
 * @var url string URL
 * @return json|bool
 */
function get_captch_url_by_url(url) {
  if (Array.isArray(settings.captchas_urls)) {
    for(var i = 0; i < settings.captchas_urls.length; i++) {
      // Ignore / and http and https
      var url_to_compare = clean_url(url);
      var captcha_url_to_compare = clean_url(settings.captchas_urls[i].insert_url);

      if (captcha_url_to_compare == url_to_compare) {
        return settings.captchas_urls[i];
      }
    }
  }

  return false;
}

/**
 * Copy a value to the clipboard
 *
 * @var debuggeeId object Debugger information
 * @var $value string value
 */
function copy_to_clipboard(debuggeeId, value) {
  chrome.tabs.executeScript(debuggeeId.tabId,
    {code: "var captcha = \"" + value + "\";"}, function() {
      chrome.tabs.executeScript(debuggeeId.tabId,
        {file: 'copy_to_clipboard.js'}, function(info) {
          chrome.notifications.create(
            {
              title: 'Copy to clipboard',
              message: 'The gCaptchaCode was successfully copy into your clipboard.',
              type: 'basic',
              iconUrl: 'icon_128.png'
            }
          );

          exit(debuggeeId, false);
      });
  });
}

/**
 * Altenative way to check for solved captcha when onEvent doesn't work.
 *
 * Mainly cause for Chrome 67 usage.
 *
 * @var $debuggeeId object
 */
function check_solved_workaround(debuggeeId) {
  if (openedTabId != null) {
    chrome.tabs.executeScript(debuggeeId.tabId,
      {code: 'document.getElementsByTagName("textarea")[0] === undefined ? \'\' : document.getElementsByTagName("textarea")[0].value'}, function(result) {
        if (Array.isArray(result) && result.length > 0 && result[0].includes("03ACgFB9")) {
          console.log("WA67: CAPTCHA found.");
          validate_and_send_to_sinkholes(result[0]);

          if (global_human_click && settings.captcha_code_clipboard) {
            // Copy to clipboard
            copy_to_clipboard(debuggeeId, result[0]);
          } else {
            exit(debuggeeId, false);
          }
        } else if (global_wa67_iterator > 55){
          console.log("WA67: CAPTCHA not found, exit.");
          exit(debuggeeId, false);
        } else {
          console.log("WA67: CAPTCHA not found, try again in 1 second. | Iteration: " + global_wa67_iterator);
          global_wa67_iterator++;

          // Check again in 1000ms
          setTimeout(function() {
            check_solved_workaround(debuggeeId);
          }, 1000);
        }
    });
  }
}

/**
 * Handle challange behaviour of the plugin
 *
 * @var debuggeeId object Debug Object
 */
function challenge_request_procedure(debuggeeId) {
  // Do not increase for multiple challenges
  if (!challenge_requested) {
    stats.requests_with_challange = stats.requests_with_challange + 1;
    stats.solved_in_a_row = 0;
    chrome.storage.sync.set({'stats': stats});

    challenge_requested = true;
  }

  if (global_human_click || (!global_human_click && settings.alert_user_solve_captcha)) {
    // Only show if it is an automated request
    if (!global_human_click || (global_human_click && !settings.new_tab_switch)) {
      // Change tab on user to solve the challenge:
      // * Automator request (background tab)
      // * Human request with switch to a new tab disabled.
      chrome.tabs.update(openedTabId, {highlighted: true});
    }

    human_solve_interaction = true;

    // Timeout after 55 seconds!
    setTimeout(function() {
      exit(debuggeeId, false);
    }, 55000);
  } else {
    exit(debuggeeId, false);
  }
}

/**
 * Capture requests and its body
 */
function onEvent(debuggeeId, message, params) {
  if (openedTabId !== debuggeeId.tabId || message !== "Network.responseReceived")
    return;

  console.log("onEvent :: [" + params.response.url + "]");

  var captcha_url = get_captch_url_by_url(params.response.url);

  if (captcha_url !== false) {
    // NOTE: The other call to replace_html_and_click is quicker, avoid
    // duplication for now.

    //replace_html_and_click(captcha_url, params.response.url, debuggeeId.tabId);
  }

  if (params.response.url.includes("https://www.google.com/recaptcha/api2/userverify?k=")) {
    // Request Body
    request_captcha_body(debuggeeId, params.requestId);
  } else if (params.response.url.includes("https://www.google.com/recaptcha/api2/payload?c=")) {
    // CAPTCHA not solved
    // NOTE: This code isn't run on Chrome 67

    time_diff = Date.now() - start_resolve_time;
    console.log(new Date() + " :: Time Diff: " + time_diff + "ms!");
    console.log("Captcha not solved!");

    challenge_request_procedure(debuggeeId);
  }
}

/**
 * Normal way to fetch CAPTCHA code, by reading the body response
 *
 * @var debuggeeId object
 * @var requestId integer
 */
function request_captcha_body(debuggeeId, requestId) {
  chrome.debugger.sendCommand({
      tabId: debuggeeId.tabId
  }, "Network.getResponseBody", {
      "requestId": requestId
  }, function(response) {
    if (response !== undefined) {
      // you get the response body here!
      // you can close the debugger tips by:
      console.log(new Date() + " :: Processing CAPTCHA ...");
      var captcha = response.body.split("uvresp\",\"");
      if (captcha.length == 2) {
        captcha = captcha[1].split("\",");
        if (captcha.length == 2) {
          captcha = captcha[0];

          time_diff = Date.now() - start_resolve_time;
          console.log(new Date() + " :: Time Diff: " + time_diff + "ms!");

          validate_and_send_to_sinkholes(captcha);

          if (global_human_click && settings.captcha_code_clipboard) {
            copy_to_clipboard(debuggeeId, captcha);
          } else {
            exit(debuggeeId, false);
          }
        }
      }
    }
  });
}

/**
 * Context Manu callback
 */
function context_menu_click(info, tab) {
  redirectToTabId = tab.id;

  create_tab(info.menuItemId, true);
}

/**
 * Create new tab, with captcha URL
 *
 * @url string URL
 * @is_human_click boolean Human action or Automator ?
 */
function create_tab(url, is_human_click) {
  global_human_click = is_human_click;
  request_sent = false;
  var is_active = is_human_click && settings.new_tab_switch;

  chrome.tabs.create({ url: url, active: is_active}, function(tab) {
    openedTabId = tab.id;

    // Reload is used here to solve a race condition on multi-core CPUs.
    // The URL is requested before all listeners are setup. So we reload to
    // request its initial information again.

    chrome.tabs.reload(openedTabId, {bypassCache: true}, function() {
      // Attach debugger on this new tab.
      chrome.debugger.attach({tabId: tab.id}, "1.0", function() {
        chrome.debugger.sendCommand({tabId: tab.id}, "Network.enable");
        chrome.debugger.onEvent.addListener(onEvent);
      });
    });
  });
}

/**
 * Exit procedure, used in several places.
 */
function exit(debuggeeId, on_removed) {
  if (openedTabId != null) {
    console.log(" :: Exit on TabId [" + debuggeeId.tabId + "]")
    if (!on_removed) {
      chrome.debugger.sendCommand({tabId: debuggeeId.tabId}, "Network.disable", {}, function() {
        chrome.debugger.detach(debuggeeId);
        chrome.tabs.remove(debuggeeId.tabId);
      });
    }

    chrome.debugger.onEvent.removeListener(onEvent);

    if (redirectToTabId != null) {
      chrome.tabs.update(redirectToTabId, {highlighted: true});
      redirectToTabId = null;
    }

    // Reset values
    human_solve_interaction = false;
    global_captcha_url = null;
    request_sent = false;
    openedTabId = null;
    challenge_requested = false;
    global_wa67_iterator = 0;
  }
}

chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
  if (tabId == openedTabId) {
    exit({tabId: tabId}, true);
  }
});

chrome.browserAction.onClicked.addListener(function(activeTab){
  // On Toolbar click, open options
  chrome.tabs.create({ url: "chrome-extension://" + chrome.runtime.id + "/options.html"});
});

function add_captcha_urls_to_context() {
  if (Array.isArray(settings.captchas_urls)) {
    chrome.contextMenus.removeAll(function() {
      settings.captchas_urls.forEach(function(captcha_url) {
        chrome.contextMenus.create({
            id: captcha_url.insert_url,
            title: captcha_url.insert_url,
            onclick: context_menu_click
          });
      });
    });
  }
}

// Load settings
chrome.storage.sync.get(['settings', 'guid', 'stats'], function(items) {
  // Generate GUID (for tracking)
  if (items.guid === undefined) {
    guid = guid();
    chrome.storage.sync.set({'guid': guid}, function() {
      console.log('GUID saved!');
    });
  } else {
    guid = items.guid;
  }

  if (items.stats === undefined) {
    stats = {
      requests_without_challange: 0,
      requests_with_challange: 0,
      solved_in_a_row: 0
    }
    chrome.storage.sync.set({'stats': stats});
  } else {
    stats = items.stats;
  }

  if (items.settings == undefined) {
    settings = {
      captcha_code_clipboard: false,
      new_tab_switch: false,
      alert_user_solve_captcha: false,
      captchas_urls: [],
      sinkholes_urls: [],
      request_interval: 120,
      automator_switch: false
    }

    // Store settings in Local Storage
    chrome.storage.sync.set({settings: settings});
  } else {
    settings = items.settings;

    // Create context
    add_captcha_urls_to_context();
  }
});

/**
 * Sync settings on changes
 */
chrome.storage.onChanged.addListener(function (changes, areaName) {
  if (changes.settings !== undefined) {
    settings = changes.settings.newValue;

    // Create context
    add_captcha_urls_to_context();
  }
});

//
// Automator
//

// Check every 5 minutes
function automate() {
  if (settings.automator_switch) {
    var time_diff = (Date.now() - last_request_timestamp) / 1000;
    console.log(new Date() + " :: Automator - Enabled! | Time Diff: [" + Math.round(time_diff / 60) + "m] ");

    if (settings.captchas_urls.length > 0 && time_diff > settings.request_interval * 60) {
      // Make a request
      last_request_timestamp = Date.now();

      create_tab(
        settings.captchas_urls[automator_url_iterator].insert_url,
        false
      );

      automator_url_iterator++;

      // Reset value
      if (settings.captchas_urls.length == automator_url_iterator) {
        automator_url_iterator = 0;
      }
    }
  } else {
    console.log(new Date() + " :: Automator - Disabled!");
  }

  setTimeout(automate, 5 * 60 * 1000);
}

setTimeout(automate, 5 * 60 * 1000);
