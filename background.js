/**
 * Running on background
 */

var openedTabId = null; // new tab ID
var redirectToTabId = null; // active tab ID, before any action
var settings, stats, guid;

// ReCaptcha URL
var global_captcha_url;

// Benchmark (time)
var start_resolve_time = null;
var end_resolve_time = null;

// Automator
var last_request_timestamp = Date.now() - 24*60*60*1000; // Set timestamp 24h before
var global_human_click, automator_url_iterator = 0;
var human_solve_interaction = false;

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

function send_to_sinkholes(referrer_url, captcha) {
  settings.sinkholes_urls.forEach(function(sinkhole_url) {
    create_request(sinkhole_url, captcha, referrer_url);
  });
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

      return {cancel: false};
    }

    // Only affect URL inside the opened tab
    if (get_captch_url_by_url(data.url) !== false) {
      return {cancel: false};
    }

    return {cancel: true};
  }
},{'urls': ["*://*/*"]}, ["blocking"]);

/**
 * Exit procedure, used in several places.
 */
function exit(debuggeeId) {
  chrome.debugger.sendCommand({tabId: debuggeeId.tabId}, "Network.disable");

  // TODO: Check one time listenger, and don't change it!
  chrome.debugger.onEvent.removeListener(onEvent);
  chrome.debugger.detach(debuggeeId);
  chrome.tabs.remove(debuggeeId.tabId);

  if (redirectToTabId != null) {
    chrome.tabs.update(redirectToTabId, {highlighted: true});
  }

  redirectToTabId = null;
  human_solve_interaction = false;
  global_captcha_url = null;
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

function onEvent(debuggeeId, message, params) {
  if (openedTabId !== debuggeeId.tabId || message !== "Network.responseReceived")
    return;

  var captcha_url = get_captch_url_by_url(params.response.url) ;

  if (captcha_url !== false) {
    global_captcha_url = params.response.url;

    setTimeout(function() {
        console.log(new Date() + " :: Replace HTML!");
        chrome.tabs.executeScript(debuggeeId.tabId,
          {code: "var site_key = \"" + captcha_url.site_key + "\";" },
            function() {
              chrome.tabs.executeScript(debuggeeId.tabId,
                {runAt: "document_end", file: "replace_recaptcha.js"});
        });

        start_resolve_time = Date.now();

        setTimeout(function() {
          console.log(new Date() + " :: Click!");
          chrome.tabs.executeScript(debuggeeId.tabId,
            {allFrames: true, runAt: "document_end", file: "recaptcha_click.js"});
        }, 3000)
      }, 1000);

    // Don't like the 1000 ms waiting, but I'm having some issues loading replace_recaptcha script.
  }

  if (params.response.url.includes("https://www.google.com/recaptcha/api2/userverify?k=")) {
    // Valid
    chrome.debugger.sendCommand({
        tabId: debuggeeId.tabId
    }, "Network.getResponseBody", {
        "requestId": params.requestId
    }, function(response) {
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

            if (!human_solve_interaction) {
              stats.requests_without_challange = stats.requests_without_challange + 1;
              stats.solved_in_a_row = stats.solved_in_a_row + 1;

              chrome.storage.sync.set({'stats': stats});
            }

            // Send token to server!
            if (!global_human_click || (global_human_click && settings.sinkhole_on_manual_request)) {
              send_to_sinkholes(global_captcha_url, captcha);
            }

            if (settings.captcha_code_clipboard) {
              chrome.tabs.executeScript(debuggeeId.tabId,
                {code: "var captcha = \"" + captcha + "\";"}, function() {
                  chrome.tabs.executeScript(debuggeeId.tabId,
                    {file: 'copy_to_clipboard.js'}, function(info) {
                      exit(debuggeeId);
                  });
              });
            } else {
              exit(debuggeeId);
            }
          }
        }
    });
  } else if (params.response.url.includes("https://www.google.com/recaptcha/api2/payload?c=")) {
    // CAPTCHA not solved

    time_diff = Date.now() - start_resolve_time;
    console.log(new Date() + " :: Time Diff: " + time_diff + "ms!");
    console.log("Captcha not solved!, will try again some time later!");

    stats.requests_with_challange = stats.requests_with_challange + 1;
    stats.solved_in_a_row = 0;
    chrome.storage.sync.set({'stats': stats});

    if (settings.alert_user_solve_captcha) {
      alert("Human, please solve this challenge!");
      human_solve_interaction = true;

      // Timeout after 55 seconds!
      setTimeout(function() { exit(debuggeeId); }, 55000);
    } else {
      exit(debuggeeId);
    }
  }
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
  var active = is_human_click && settings.new_tab_switch;

  chrome.tabs.create({ url: url, active: active }, function(tab) {
    openedTabId = tab.id;

    // Attach debugger on this new tab.
    chrome.debugger.attach({tabId: tab.id}, "1.0", function() {
      chrome.debugger.sendCommand({tabId: tab.id}, "Network.enable");
      chrome.debugger.onEvent.addListener(onEvent);
    });
  });
}

chrome.browserAction.onClicked.addListener(function(activeTab){
  // Open Options
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
    console.log(new Date() + " :: Automator - Enabled! | Time Diff: [" + time_diff + "] ");

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
