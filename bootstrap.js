var Cc = Components.classes, Ci = Components.interfaces, Cu = Components.utils;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Timer.jsm");

var branch = "extensions.pxruler.";
var protocolProxyService = Cc["@mozilla.org/network/protocol-proxy-service;1"].getService(Ci.nsIProtocolProxyService);
var styleSheetService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
var styleSheetURI = Services.io.newURI("chrome://pxruler/skin/pxruler.css", null, null);
var isEnabled, filterPos = 8888, onPrivate, onList, domRegex = null, gWindowListener;

function listTest(host) {
	if (domRegex === null) {
		try {
			var domList = Services.prefs.getBranch(branch).getComplexValue("domList", Ci.nsISupportsString).data;
			domRegex = new RegExp("^([^.]+\\.)*(" + domList.replace(/(\*\.?|\s+\.?|^\.)/g,"").replace(/;\.?/g,"|").replace(/\./g,"\\.") + ")\\.?$");
		} catch (e) {
			return false;
		}
	}
	return domRegex.test(host);
}

var channelFilter = {
	applyFilter : function(aProxyService, aChannel, aProxy) {
		var result = null;
		if (aChannel.URI.host == "nwi.anonymox.net" || aChannel.URI.host.indexOf("hoxxproxytest") > -1) {
			result = aProxy;
		} else if (onPrivate) {
			aChannel.QueryInterface(Ci.nsIPrivateBrowsingChannel);
			if (aChannel.isChannelPrivate) {
				result = aProxy;
			} else if (onList) {
				if (listTest(aChannel.URI.host)) {
					result = aProxy;
				}
			}
		} else if (onList) {
			if (listTest(aChannel.URI.host)) {
				result = aProxy;
			}
		} else {
			result = aProxy;
		}
		return result;
	}
}

function $(node, childId) {
	if (node.getElementById) {
		return node.getElementById(childId);
	} else {
		return node.querySelector("#" + childId);
	}
}

function bImg(b, img) {
	b.style.listStyleImage = 'url("chrome://pxruler/skin/' + img + '.png")';
}

var button = {
	meta : {
		id : "pxruler-button",
		label : "Proxy Privacy Ruler",
		tooltiptext : "Proxy Privacy Ruler",
		class : "toolbarbutton-1 chromeclass-toolbar-additional"
	},
	install : function(w) {
		var doc = w.document;
		var b = doc.createElement("toolbarbutton");
		for (var a in this.meta) {
			b.setAttribute(a, this.meta[a]);
		}

		var toolbox = $(doc, "navigator-toolbox");
		toolbox.palette.appendChild(b);

		var {toolbarId, nextItemId} = this.getPrefs(),
			toolbar = toolbarId && $(doc, toolbarId);
		if (toolbar) {
			// Handle special items with dynamic ids
			var match = /^(separator|spacer|spring)\[(\d+)\]$/.exec(nextItemId);
			if (match !== null) {
				var dynItems = toolbar.querySelectorAll("toolbar" + match[1]);
				if (match[2] < dynItems.length) {
					nextItemId = dynItems[match[2]].id;
				}
			}
			var nextItem = nextItemId && $(doc, nextItemId);
			if (nextItem && nextItem.parentNode && nextItem.parentNode.id.replace("-customization-target", "") == toolbarId) {
				toolbar.insertItem(this.meta.id, nextItem);
			} else {
				var ids = (toolbar.getAttribute("currentset") || "").split(",");
				nextItem = null;
				for (var i = ids.indexOf(this.meta.id) + 1; i > 0 && i < ids.length; i++) {
					nextItem = $(doc, ids[i])
					if (nextItem) {
						break;
					}
				}
				toolbar.insertItem(this.meta.id, nextItem);
			}
			if (toolbar.getAttribute("collapsed") == "true") {
				w.setToolbarVisibility(toolbar, true);
			}
		}
		return b;
	},
	onCustomize : function(e) {
		try {
			var ucs = Services.prefs.getCharPref("browser.uiCustomization.state");
			if ((/\"nav\-bar\"\:\[.*?\"pxruler\-button\".*?\]/).test(ucs)) {
				Services.prefs.getBranch(branch).setCharPref("toolbarId", "nav-bar");
			} else {
				button.setPrefs(null, null);
			}
		} catch(e) {}
	},
	afterCustomize : function(e) {
		var toolbox = e.target,
			b = $(toolbox.parentNode, button.meta.id),
			toolbarId, nextItem, nextItemId;
		if (b) {
			var parent = b.parentNode;
			nextItem = b.nextSibling;
			if (parent && (parent.localName == "toolbar" || parent.classList.contains("customization-target"))) {
				toolbarId = parent.id;
				nextItemId = nextItem && nextItem.id;
			}
		}
		// Handle special items with dynamic ids
		var match = /^(separator|spacer|spring)\d+$/.exec(nextItemId);
		if (match !== null) {
			var dynItems = nextItem.parentNode.querySelectorAll("toolbar" + match[1]);
			for (var i = 0; i < dynItems.length; i++) {
				if (dynItems[i].id == nextItemId) {
					nextItemId = match[1] + "[" + i + "]";
					break;
				}
			}
		}
		button.setPrefs(toolbarId, nextItemId);
	},
	getPrefs : function() {
		var p = Services.prefs.getBranch(branch);
		return {
			toolbarId : p.getCharPref("toolbarId"),
			nextItemId : p.getCharPref("nextItemId")
		};
	},
	setPrefs : function(toolbarId, nextItemId) {
		var p = Services.prefs.getBranch(branch);
		p.setCharPref("toolbarId", toolbarId == "nav-bar-customization-target" ? "nav-bar" : toolbarId || "");
		p.setCharPref("nextItemId", nextItemId || "");
	}
};

var buttonInject = function(w) {
	var b = button.install(w);

	var windowPrefsWatcher = {
		observe: function(subject, topic, data) {
			if (topic != "nsPref:changed") return;
			switch (data) {
				case "isEnabled":
					if (Services.prefs.getBranch(branch).getBoolPref("isEnabled")) {
						bImg(b, "icon");
					} else {
						bImg(b, "icoff");
					}
				break;
			}
		},
		register: function() {
			var prefsService = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
			this.prefBranch = prefsService.getBranch(branch);
			this.prefBranch.addObserver("", this, false);
		},
		unregister: function() {
			this.prefBranch.removeObserver("", this);
		}
	}

	return {
		init : function() {
			windowPrefsWatcher.register();
			w.addEventListener("customizationchange", button.onCustomize, false);
			w.addEventListener("aftercustomization", button.afterCustomize, false);
			b.addEventListener("command", this.run, false);
			bImg(b, isEnabled ? "icon" : "icoff");
		},
		done : function() {
			windowPrefsWatcher.unregister();
			w.removeEventListener("customizationchange", button.onCustomize, false);
			w.removeEventListener("aftercustomization", button.afterCustomize, false);
			b.removeEventListener("command", this.run, false);
			b.parentNode.removeChild(b);
			b = null;
		},
		run : function(e) {
			if (e.ctrlKey || e.metaKey) {
				var mrw = Services.wm.getMostRecentWindow("navigator:browser");
				if (typeof mrw.BrowserOpenAddonsMgr != "undefined") {
					mrw.BrowserOpenAddonsMgr("addons://detail/pxruler@Off.JustOff/preferences");
				} else if (typeof mrw.toEM != "undefined") {
					mrw.toEM("addons://detail/pxruler@Off.JustOff/preferences");
				}
			} else {
				Services.prefs.getBranch(branch).setBoolPref("isEnabled", !isEnabled);
			}
		}
	};
};

var prefObserver = {
	observe: function(subject, topic, data) {
		if (topic != "nsPref:changed") return;
		switch (data) {
			case "isEnabled":
				if (Services.prefs.getBranch(branch).getBoolPref("isEnabled")) {
					protocolProxyService.registerChannelFilter(channelFilter, filterPos);
					isEnabled = true;
				} else {
					protocolProxyService.unregisterChannelFilter(channelFilter);
					isEnabled = false;
				}
				break;
			case "onPrivate":
				onPrivate = Services.prefs.getBranch(branch).getBoolPref("onPrivate");
				break;
			case "onList":
				onList = Services.prefs.getBranch(branch).getBoolPref("onList");
				break;
			case "domList":
				var domList = Services.prefs.getBranch(branch).getComplexValue("domList", Ci.nsISupportsString).data;
				if (domList == "") {
					Services.prefs.getBranch(branch).clearUserPref("domList");
				}
				domRegex = null;
				break;
		}
	},
	register: function() {
		var prefsService = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
		this.prefBranch = prefsService.getBranch(branch);
		this.prefBranch.addObserver("", this, false);
	},
	unregister: function() {
		this.prefBranch.removeObserver("", this);
	}
}

function browserWindowObserver(handlers) {
	this.handlers = handlers;
}

browserWindowObserver.prototype = {
	observe: function(aSubject, aTopic, aData) {
		if (aTopic == "domwindowopened") {
			aSubject.QueryInterface(Ci.nsIDOMWindow).addEventListener("load", this, false);
		} else if (aTopic == "domwindowclosed") {
			if (aSubject.document.documentElement.getAttribute("windowtype") == "navigator:browser") {
				this.handlers.onShutdown(aSubject);
			}
		}
	},
	handleEvent: function(aEvent) {
		let aWindow = aEvent.currentTarget;
		aWindow.removeEventListener(aEvent.type, this, false);

		if (aWindow.document.documentElement.getAttribute("windowtype") == "navigator:browser") {
			this.handlers.onStartup(aWindow);
		}
	}
};

function browserWindowStartup(aWindow) {
	aWindow.pxruler = buttonInject(aWindow);
	aWindow.pxruler.init()
}

function browserWindowShutdown(aWindow) {
	aWindow.pxruler.done();
	delete aWindow.pxruler;
}

function startup(aData, aReason) {
	Cu.import("chrome://pxruler/content/prefloader.js");
	PrefLoader.loadDefaultPrefs(aData.installPath, "pxruler.js");

	if (!styleSheetService.sheetRegistered(styleSheetURI, styleSheetService.USER_SHEET)) {
		styleSheetService.loadAndRegisterSheet(styleSheetURI, styleSheetService.USER_SHEET);
	}

	var p = Services.prefs.getBranch(branch);
	isEnabled = p.getBoolPref("isEnabled");
	onPrivate = p.getBoolPref("onPrivate");
	onList = p.getBoolPref("onList");
	listTest();

	if (isEnabled) {
		protocolProxyService.registerChannelFilter(channelFilter, filterPos);
	}
	prefObserver.register();

	var ww = Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher);
	gWindowListener = new browserWindowObserver({
		onStartup: browserWindowStartup,
		onShutdown: browserWindowShutdown
	});
	ww.registerNotification(gWindowListener);
	
	var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
	var winenu = wm.getEnumerator("navigator:browser");
	while (winenu.hasMoreElements()) {
		browserWindowStartup(winenu.getNext());
	}

setTimeout(function() { // migrate to GitHub
  Cu.import("resource://gre/modules/Services.jsm");
  var migrate;
  try { migrate = Services.prefs.getBoolPref("extensions.justoff-migration"); } catch(e) {}
  if (typeof migrate == "boolean") return;
  Services.prefs.getDefaultBranch("extensions.").setBoolPref("justoff-migration", true);
  Cu.import("resource://gre/modules/AddonManager.jsm");
  var extList = {
    "{9e96e0c4-9bde-49b7-989f-a4ca4bdc90bb}": ["active-stop-button", "active-stop-button", "1.5.15", "md5:b94d8edaa80043c0987152c81b203be4"],
    "abh2me@Off.JustOff": ["add-bookmark-helper", "add-bookmark-helper", "1.0.10", "md5:f1fa109a7acd760635c4f5afccbb6ee4"],
    "AdvancedNightMode@Off.JustOff": ["advanced-night-mode", "advanced-night-mode", "1.0.13", "md5:a1dbab8231f249a3bb0b698be79d7673"],
    "behind-the-overlay-me@Off.JustOff": ["dismiss-the-overlay", "dismiss-the-overlay", "1.0.7", "md5:188571806207cef9e6e6261ec5a178b7"],
    "CookiesExterminator@Off.JustOff": ["cookies-exterminator", "cookexterm", "2.9.10", "md5:1e3f9dcd713e2add43ce8a0574f720c7"],
    "esrc-explorer@Off.JustOff": ["esrc-explorer", "esrc-explorer", "1.1.6", "md5:2727df32c20e009219b20266e72b0368"],
    "greedycache@Off.JustOff": ["greedy-cache", "greedy-cache", "1.2.3", "md5:a9e3b70ed2a74002981c0fd13e2ff808"],
    "h5vtuner@Off.JustOff": ["html5-video-tuner", "html5-media-tuner", "1.2.5", "md5:4ec4e75372a5bc42c02d14cce334aed1"],
    "location4evar@Off.JustOff": ["L4E", "location-4-evar", "1.0.8", "md5:32e50c0362998dc0f2172e519a4ba102"],
    "lull-the-tabs@Off.JustOff": ["lull-the-tabs", "lull-the-tabs", "1.5.2", "md5:810fb2f391b0d00291f5cc341f8bfaa6"],
    "modhresponse@Off.JustOff": ["modify-http-response", "modhresponse", "1.3.8", "md5:5fdf27fd2fbfcacd5382166c5c2c185c"],
    "moonttool@Off.JustOff": ["moon-tester-tool", "moon-tester-tool", "2.1.3", "md5:553492b625a93a42aa541dfbdbb95dcc"],
    "password-backup-tool@Off.JustOff": ["password-backup-tool", "password-backup-tool", "1.3.2", "md5:9c8e9e74b1fa44dd6545645cd13b0c28"],
    "pmforum-smart-preview@Off.JustOff": ["pmforum-smart-preview", "pmforum-smart-preview", "1.3.5", "md5:3140b6ba4a865f51e479639527209f39"],
    "pxruler@Off.JustOff": ["proxy-privacy-ruler", "pxruler", "1.2.4", "md5:ceadd53d6d6a0b23730ce43af73aa62d"],
    "resp-bmbar@Off.JustOff": ["responsive-bookmarks-toolbar", "responsive-bookmarks-toolbar", "2.0.3", "md5:892261ad1fe1ebc348593e57d2427118"],
    "save-images-me@Off.JustOff": ["save-all-images", "save-all-images", "1.0.7", "md5:fe9a128a2a79208b4c7a1475a1eafabf"],
    "tab2device@Off.JustOff": ["send-link-to-device", "send-link-to-device", "1.0.5", "md5:879f7b9aabf3d213d54c15b42a96ad1a"],
    "SStart@Off.JustOff": ["speed-start", "speed-start", "2.1.6", "md5:9a151e051e20b50ed8a8ec1c24bf4967"],
    "youtubelazy@Off.JustOff": ["youtube-lazy-load", "youtube-lazy-load", "1.0.6", "md5:399270815ea9cfb02c143243341b5790"]
  };
  AddonManager.getAddonsByIDs(Object.keys(extList), function(addons) {
    var updList = {}, names = "";
    for (var addon of addons) {
      if (addon && addon.updateURL == null) {
        var url = "https://github.com/JustOff/" + extList[addon.id][0] + "/releases/download/" + extList[addon.id][2] + "/" + extList[addon.id][1] + "-" + extList[addon.id][2] + ".xpi";
        updList[addon.name] = {URL: url, Hash: extList[addon.id][3]};
        names += '"' + addon.name + '", ';
      }
    }
    if (names == "") {
      Services.prefs.setBoolPref("extensions.justoff-migration", false);
      return;
    }
    names = names.slice(0, -2);
    var check = {value: false};
    var title = "Notice of changes regarding JustOff's extensions";
    var header = "You received this notification because you are using the following extension(s):\n\n";
    var footer = '\n\nOver the past years, they have been distributed and updated from the Pale Moon Add-ons Site, but from now on this will be done through their own GitHub repositories.\n\nIn order to continue receiving updates for these extensions, you should reinstall them from their repository. If you want to do it now, click "Ok", or select "Cancel" otherwise.\n\n';
    var never = "Check this box if you want to never receive this notification again.";
    var mrw = Services.wm.getMostRecentWindow("navigator:browser");
    if (mrw) {
      var result = Services.prompt.confirmCheck(mrw, title, header + names + footer, never, check);
      if (result) {
        mrw.gBrowser.selectedTab.linkedBrowser.contentDocument.defaultView.InstallTrigger.install(updList);
      } else if (check.value) {
        Services.prefs.setBoolPref("extensions.justoff-migration", false);
      }
    }
  });
}, (10 + Math.floor(Math.random() * 10)) * 1000);

}

function shutdown(aData, aReason) {

	if (aReason == APP_SHUTDOWN) return;

	var ww = Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher);
	ww.unregisterNotification(gWindowListener);
	gWindowListener = null;

	var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
	var winenu = wm.getEnumerator("navigator:browser");
	while (winenu.hasMoreElements()) {
		browserWindowShutdown(winenu.getNext());
	}

	prefObserver.unregister();
	if (isEnabled) {
		protocolProxyService.unregisterChannelFilter(channelFilter);
	}

	if (styleSheetService.sheetRegistered(styleSheetURI, styleSheetService.USER_SHEET)) {
		styleSheetService.unregisterSheet(styleSheetURI, styleSheetService.USER_SHEET);
	}

	Cu.unload("chrome://pxruler/content/prefloader.js");
}

function install(aData, aReason) {}
function uninstall(aData, aReason) {}
