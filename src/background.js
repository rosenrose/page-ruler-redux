"use strict";

var PageRuler = {
    init: function(type, previousVersion) {
        console.log("init");
        var manifest = chrome.runtime.getManifest();
        var version = manifest.version;
        switch (type) {
          case "install":
            console.log("First time install version: ", version);
            chrome.storage.sync.set({
                hide_update_tab: false
            });
            break;

          case "update":
            console.log("Update version. From: ", previousVersion, " To: ", version);
            break;

          default:
            console.log("Existing version run: ", version);
            break;
        }
    },
    image: function(file) {
        return {
            "19": "images/19/" + file,
            "38": "images/38/" + file
        };
    },
    load: function(tabId) {
        console.log("loading content script");
        chrome.scripting.executeScript({
            target: { tabId },
            files: ["content.js"]
        }, function() {
            console.log("content script for tab #" + tabId + " has loaded");
            PageRuler.enable(tabId);
        });
    },
    enable: function(tabId) {
        chrome.tabs.sendMessage(tabId, {
            type: "enable"
        }, function(success) {
            console.log("enable message for tab #" + tabId + " was sent");
            chrome.action.setIcon({
                path: PageRuler.image("browser_action_on.png"),
                tabId: tabId
            });
        });
    },
    disable: function(tabId) {
        chrome.tabs.sendMessage(tabId, {
            type: "disable"
        }, function(success) {
            console.log("disable message for tab #" + tabId + " was sent");
            chrome.action.setIcon({
                path: PageRuler.image("browser_action.png"),
                tabId: tabId
            });
        });
    },
    action: function(tab) {
        var tabId = tab.id;
        
        chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                chrome.runtime.sendMessage({
                    action: "loadtest",
                    loaded: window.hasOwnProperty("__PageRuler"),
                    active: window.hasOwnProperty("__PageRuler") && window.__PageRuler.active,
                });
            }
        });
    },
    openUpdateTab: function(type) {
        chrome.storage.sync.get("hide_update_tab", function(items) {
            if (!items.hide_update_tab) {
                chrome.tabs.create({
                    url: "update.html#" + type
                });
            }
        });
    },
    setPopup: function(tabId, changeInfo, tab) {
        var url = changeInfo.url || tab.url || false;
        if (!!url) {
            if (/^chrome\-extension:\/\//.test(url) || /^chrome:\/\//.test(url)) {
                chrome.action.setPopup({
                    tabId: tabId,
                    popup: "popup.html#local"
                });
            }
            if (/^https:\/\/chrome\.google\.com\/webstore\//.test(url)) {
                chrome.action.setPopup({
                    tabId: tabId,
                    popup: "popup.html#webstore"
                });
            }
        }
    },
};

chrome.action.onClicked.addListener(PageRuler.action);

chrome.tabs.onUpdated.addListener(PageRuler.setPopup);

chrome.runtime.onStartup.addListener(function() {
    console.log("onStartup");
    PageRuler.init();
});

chrome.runtime.onInstalled.addListener(function(details) {
    console.log("onInstalled");
    PageRuler.init(details.reason, details.previousVersion);
    switch (details.reason) {
      case "install":
        PageRuler.openUpdateTab("install");
        break;

      case "update":
        PageRuler.openUpdateTab("update");
        break;
    }
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    var tabId = sender.tab && sender.tab.id;
    console.group("message received from tab #" + tabId);
    console.log("message: ", message);
    console.log("sender: ", sender);
    switch (message.action) {
      case "borderSearch":
        const { width, height } = sender.tab

        chrome.tabs.captureVisibleTab({
            format: "png"
        }, (dataUrl) => {
            sendResponse({ width, height, dataUrl });
        });
        break;

      case "loadtest":
        if (!message.loaded) {
            PageRuler.load(tabId);
        } else {
            if (message.active) {
                PageRuler.disable(tabId);
            } else {
                PageRuler.enable(tabId);
            }
        }
        break;

      case "disable":
        console.log("tear down");
        if (!!tabId) {
            PageRuler.disable(tabId);
        }
        break;

      case "setColor":
        console.log("saving color " + message.color);
        chrome.storage.sync.set({
            color: message.color
        });
        break;

      case "getColor":
        console.log("requesting color");
        chrome.storage.sync.get("color", function(items) {
            var color = items.color || "#5b5bdc";
            console.log("color requested: " + color);
            sendResponse(color);
        });
        break;

      case "setDockPosition":
        console.log("saving dock position " + message.position);
        chrome.storage.sync.set({
            dock: message.position
        });
        break;

      case "getDockPosition":
        console.log("requesting dock position");
        chrome.storage.sync.get("dock", function(items) {
            var position = items.dock || "top";
            console.log("dock position requested: " + position);
            sendResponse(position);
        });
        break;

      case "setGuides":
        console.log("saving guides visiblity " + message.visible);
        chrome.storage.sync.set({
            guides: message.visible
        });
        break;

      case "getGuides":
        console.log("requesting guides visibility");
        chrome.storage.sync.get("guides", function(items) {
            var visiblity = items.hasOwnProperty("guides") ? items.guides : true;
            console.log("guides visibility requested: " + visiblity);
            sendResponse(visiblity);
        });
        break;

      case "setBorderSearch":
        chrome.storage.sync.set({
            borderSearch: message.visible
        });
        break;

      case "getBorderSearch":
        chrome.storage.sync.get("borderSearch", function(items) {
            var visiblity = items.hasOwnProperty("borderSearch") ? items.borderSearch : false;
            sendResponse(visiblity);
        });
        break;

      case "openHelp":
        chrome.tabs.create({
            url: chrome.runtime.getURL("update.html") + "#help"
        });
        break;
    }
    console.groupEnd();
    return true;
});

chrome.commands.onCommand.addListener(function(command) {
    console.log("Command:", command);
});
