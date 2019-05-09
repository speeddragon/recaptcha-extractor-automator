// Allow to remove an item from an array by URL and KEY.
Array.prototype.removeByUrlAndKey = function(url, key) {
  var idx = this.findIndex(i => i.insert_url === url && i.site_key === key);
  if (idx != -1) {
    return this.splice(idx, 1);
  }
  return false;
};

// Allow to remove an item from an array.
Array.prototype.remove = function(value) {
  var idx = this.indexOf(value);
  if (idx != -1) {
    return this.splice(idx, 1);
  }
  return false;
};

// Global vars
var settings, stats;

// Setup CLICK actions
// Chrome Extensions don't allow inline javascript code.
document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("save").addEventListener("click", save_options);
  document.getElementById("add_url").addEventListener("click", add_captcha_url);
  document
    .getElementById("sinkhole_add_url")
    .addEventListener("click", add_sinkhole_url);

  document
    .getElementById("read_settings_file")
    .addEventListener("click", load_from_file);

  // Update normal settings
  document
    .getElementById("request_interval")
    .addEventListener("change", update_setting);
  document
    .getElementById("captcha_code_clipboard")
    .addEventListener("change", update_setting);
  document
    .getElementById("new_tab_switch")
    .addEventListener("change", update_setting);
  document
    .getElementById("alert_user_solve_captcha")
    .addEventListener("change", update_setting);
  document
    .getElementById("automator_switch")
    .addEventListener("change", update_setting);
  document
    .getElementById("sinkhole_on_manual_request")
    .addEventListener("change", update_setting);

  // Captcha URLs
  var delete_captcha_url_list = document.getElementsByClassName(
    "delete_captcha_url"
  );
  for (var i = 0; i < delete_captcha_url_list.length; i++) {
    (function(index) {
      delete_captcha_url_list[index].addEventListener(
        "click",
        delete_captcha_url
      );
    })(i);
  }

  // Sinkholes URLs
  var delete_sinkhole_url_list = document.getElementsByClassName(
    "delete_sinkhole_url"
  );
  for (var i = 0; i < delete_sinkhole_url_list.length; i++) {
    (function(index) {
      delete_sinkhole_url_list[index].addEventListener(
        "click",
        delete_sinkhole_url
      );
    })(i);
  }

  // URL Trigger
  var add_url_trigger_btn = document.getElementById("add_url_trigger_btn");
  add_url_trigger_btn.addEventListener("click", add_automatic_url_trigger);

  // TODO: Map delete button.
});

/**
 * Load file JSON with setting
 */
function load_from_file() {
  var file = document.getElementById("settings_file").files[0];
  var reader = new FileReader();
  reader.onload = function(e) {
    settings = JSON.parse(e.target.result);
    console.log(" :: Loading settings file");
    console.log(settings);

    update_html_settings();
  };
  reader.readAsText(file);
}

function update_download_file() {
  var dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(settings));
  var dlAnchorElem = document.getElementById("save_settings_file");
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", "settings.json");
}

/**
 * Update setting
 */
function update_setting(item) {
  if (item.target.type == "checkbox") {
    settings[item.target.id] = item.target.checked;
  } else {
    settings[item.target.id] = item.target.value;
  }
}

/**
 * Save settings
 */
function save_options() {
  // Store settings in Local Storage
  chrome.storage.sync.set(
    {
      settings: settings
    },
    function() {
      // Update status to let user know options were saved.
      var status = document.getElementById("status");
      status.textContent = "Options saved.";

      setTimeout(function() {
        status.textContent = "";
      }, 1500);
    }
  );
}

/**
 * Make request to extract ReCaptcha Public Key. This key is used to create the blank page
 * that request the ReCaptcha information.
 *
 * @param {String} url
 */
function extract_captcha_key(url) {
  var request = new XMLHttpRequest();
  request.addEventListener("load", x => {
    // TODO: Improve this code
    var captcha_key_1 = x.srcElement.responseText.split('"captchaPublicKey":"');
    var captcha_key_2 = x.srcElement.responseText.split(
      'initRecaptchaValidation("'
    );
    var captcha_key_3 = x.srcElement.responseText.split('data-sitekey="');
    var captcha_key_4 = x.srcElement.responseText.split('"6L');

    if (captcha_key_1.length > 1) {
      captcha_key_1 = captcha_key_1[1].split('"');
      console.log(captcha_key_1[0]);

      add_captcha_url_main(url, captcha_key_1[0].trim());
    } else if (captcha_key_2.length > 1) {
      captcha_key_2 = captcha_key_2[1].split('"');
      console.log(captcha_key_2[0]);

      add_captcha_url_main(url, captcha_key_2[0].trim());
    } else if (captcha_key_3.length > 1) {
      captcha_key_3 = captcha_key_3[1].split('"');
      console.log(captcha_key_3[0]);

      add_captcha_url_main(url, captcha_key_3[0].trim());
    } else if (captcha_key_4.length > 1) {
      // BETA Version generic extractor
      captcha_key_4 = captcha_key_4[1].split('"');
      console.log(captcha_key_4[0]);

      add_captcha_url_main(url, captcha_key_4[0].trim());
    } else {
      alert("Not captcha public key found!");
    }
  });
  request.open("GET", url);
  request.send();
}

/**
 * Add Captcha URL properties (URL, Site Key)
 */
function add_captcha_url() {
  // TODO: Apply string validation to avoid XSS
  var insert_url = document.getElementById("insert_url").value.trim();

  // Allow it to add manually
  var site_key = document.getElementById("site_key").value.trim();

  if (site_key.length > 0) {
    add_captcha_url_main(insert_url, site_key);
  } else {
    // Extract captcha key from website
    extract_captcha_key(insert_url);
  }
}

/**
 * Insert URL and Captcha Public Key
 *
 * @param {string} insert_url
 * @param {string} site_key
 */
function add_captcha_url_main(url, site_key) {
  // Clean up values
  document.getElementById("insert_url").value = "";
  document.getElementById("site_key").value = "";

  // Initialize
  if (settings.captchas_urls == undefined) {
    settings.captchas_urls = [];
  }

  var item = {
    insert_url: url.substr(0, url.indexOf("/", 9)),
    site_key: site_key
  };

  settings.captchas_urls.push(item);

  add_captcha_url_to_table(item);
}

/**
 * Add Captcha URL to Trigger select marker
 * @param {object} captcha_url_object
 */
function add_captcha_url_to_insert_trigger(captcha_url_object) {
  var html = document.getElementById("add_url_trigger_captcha_url_list");

  var option = document.createElement("option");
  option.setAttribute("value", captcha_url_object.insert_url);
  option.innerText = captcha_url_object.insert_url;

  html.appendChild(option);
}

/**
 * Add sinkhole URL
 */
function add_sinkhole_url() {
  var url = document.getElementById("sinkhole_insert_url").value.trim();

  // Clean up values
  document.getElementById("sinkhole_insert_url").value = "";

  // Initialize
  if (settings.sinkholes_urls == undefined) {
    settings.sinkholes_urls = [];
  }

  settings.sinkholes_urls.push(url);

  add_sinkhole_url_to_table(url);
}

function add_automatic_url_trigger() {
  var trigger_url = document.getElementById("url_trigger_url").value.trim();
  var code = document.getElementById("url_trigger_code").value.trim();
  var captcha_url = document
    .getElementById("url_trigger_captcha_url")
    .value.trim();

  // Clean up values
  document.getElementById("sinkhole_insert_url").value = "";

  // Initialize
  if (settings.urls_trigger == undefined) {
    settings.urls_trigger = [];
  }

  settings.urls_trigger.push(url);

  add_sinkhole_url_to_table(url);
}

function delete_captcha_url(item) {
  var url = item.target.getAttribute("data-url");
  var key = item.target.getAttribute("data-key");

  settings.captchas_urls.removeByUrlAndKey(url, key);

  // Delete from HTML
  var captchas_urls_html = document.getElementById("captchas_urls");
  captchas_urls_html.removeChild(item.path[2]);
}

function delete_sinkhole_url(item) {
  var url = item.target.getAttribute("data-url");

  settings.sinkholes_urls.remove(url);

  // Delete from HTML
  var sinkholes_urls_html = document.getElementById("sinkholes_urls");
  sinkholes_urls_html.removeChild(item.path[2]);
}

function add_captcha_url_to_table(captcha_url) {
  var captchas_urls_html = document.getElementById("captchas_urls");

  var tr = document.createElement("tr");
  var td_url = document.createElement("td");
  td_url.appendChild(document.createTextNode(captcha_url.insert_url));

  var td_key = document.createElement("td");
  td_key.appendChild(document.createTextNode(captcha_url.site_key));

  var td_action = document.createElement("td");
  var button_delete = document.createElement("button");
  button_delete.setAttribute("data-url", captcha_url.insert_url);
  button_delete.setAttribute("data-key", captcha_url.site_key);
  button_delete.setAttribute("class", "delete_captcha_url");
  button_delete.addEventListener("click", delete_captcha_url);
  button_delete.textContent = "Delete";

  td_action.appendChild(button_delete);

  tr.appendChild(td_url);
  tr.appendChild(td_key);
  tr.appendChild(td_action);

  captchas_urls_html.appendChild(tr);
}

function add_sinkhole_url_to_table(sinkhole_url) {
  var sinkholes_urls_html = document.getElementById("sinkholes_urls");

  var tr = document.createElement("tr");
  var td_url = document.createElement("td");
  td_url.appendChild(document.createTextNode(sinkhole_url));

  var td_action = document.createElement("td");
  var button_delete = document.createElement("button");
  button_delete.setAttribute("data-url", sinkhole_url);
  button_delete.setAttribute("class", "delete_sinkhole_url");
  button_delete.addEventListener("click", delete_sinkhole_url);
  button_delete.textContent = "Delete";

  td_action.appendChild(button_delete);

  tr.appendChild(td_url);
  tr.appendChild(td_action);

  sinkholes_urls_html.appendChild(tr);
}

function add_automatic_url_trigger_to_list(url_trigger, code, captcha_url) {
  var html = document.getElementById("automatic_url_triggers");
  var div = document.createElement("div");

  // Text [URL]
  var div_url_text = document.createElement("div");
  div_url_text.innerText = "URL:";

  // Input
  var div_url_input = document.createElement("div");

  var url_input = document.createElement("input");
  url_input.setAttribute("class", "url_trigger_input");
  url_input.setAttribute("value", url_trigger);
  url_input.setAttribute("readonly", "");

  div_url_input.appendChild(url_input);

  // Text [Code]
  var div_code_text = document.createElement("div");
  div_code_text.innerText = "Code:";

  // Textarea
  var div_code_input = document.createElement("div");
  var code_input = document.createElement("textarea");
  code_input.setAttribute("class", "url_trigger_input");
  code_input.setAttribute("readonly", "");
  div_code_input.appendChild(code_input);

  // Text [Captcha]
  var div_url_captcha_text = document.createElement("div");
  div_url_captcha_text.innerText = "Captcha URL";

  // Input [Captcha]
  var div_url_captcha_select = document.createElement("div");
  div_url_captcha_select.appendChild(div_url_captcha_select);

  div.appendChild(div_url_text);
  div.appendChild(div_url_input);
  div.appendChild(div_code_text);
  div.appendChild(div_code_input);
  div.appendChild(div_url_captcha_text);
  div.appendChild(div_url_captcha_select);

  var div_action = document.createElement("div");
  var button_delete = document.createElement("button");
  button_delete.setAttribute("data-url", url_trigger);
  button_delete.setAttribute("class", "delete_url_trigger");
  button_delete.addEventListener("click", delete_url_trigger);
  button_delete.textContent = "Delete";

  div_action.appendChild(button_delete);
  div.appendChild(div_action);

  html.appendChild(div);
}

function show_stats_in_html() {
  document.getElementById("requests_without_challange").innerHTML =
    stats.requests_without_challange;
  document.getElementById("requests_with_challange").innerHTML =
    stats.requests_with_challange;
  document.getElementById("solved_in_a_row").innerHTML = stats.solved_in_a_row;

  // TODO: Add automator last run date
}

/**
 * Sync stats on changes
 */
chrome.storage.onChanged.addListener(function(changes, areaName) {
  if (changes.stats !== undefined) {
    stats = changes.stats.newValue;

    // Create context
    show_stats_in_html();
  }
});

function update_html_settings() {
  document.getElementById("captcha_code_clipboard").checked =
    settings.captcha_code_clipboard;
  document.getElementById("new_tab_switch").checked = settings.new_tab_switch;
  document.getElementById("alert_user_solve_captcha").checked =
    settings.alert_user_solve_captcha;
  document.getElementById("sinkhole_on_manual_request").checked =
    settings.sinkhole_on_manual_request;

  document.getElementById("automator_switch").checked =
    settings.automator_switch;

  // Clean up
  var html_captchas_urls = document.getElementById("captchas_urls");
  while (html_captchas_urls.childElementCount > 1) {
    html_captchas_urls.removeChild(html_captchas_urls.firstChild);
  }

  // Populate CAPTCHAs URLs
  if (Array.isArray(settings.captchas_urls)) {
    settings.captchas_urls.forEach(function(captcha_url) {
      add_captcha_url_to_table(captcha_url);
      add_captcha_url_to_insert_trigger(captcha_url);
    });
  }

  // Clean up
  var html_sinkholes_urls = document.getElementById("sinkholes_urls");
  while (html_sinkholes_urls.childElementCount > 1) {
    html_sinkholes_urls.removeChild(html_sinkholes_urls.firstChild);
  }

  // Populate Sinkholes URLs
  if (Array.isArray(settings.sinkholes_urls)) {
    settings.sinkholes_urls.forEach(function(sink_url) {
      add_sinkhole_url_to_table(sink_url);
    });
  }

  // Populate Automatic URL Trigger
  if (Array.isArray(settings.urls_trigger)) {
    settings.urls_trigger.forEach(function(url_trigger_object) {
      add_automatic_url_trigger(
        url_trigger_object.trigger_url,
        url_trigger_object.code,
        url_trigger_object.captcha_url
      );
    });
  }

  // Request every
  document.getElementById("request_interval").value = settings.request_interval;

  update_download_file();
}

// Load Settings
chrome.storage.sync.get(["settings", "stats"], function(items) {
  if (items.stats !== undefined) {
    stats = items.stats;

    show_stats_in_html();
  }

  if (items.settings == undefined) {
    alert(
      "Some weird thing happen, default values should be available already!"
    );
  } else {
    settings = items.settings;

    update_html_settings();
  }
});
