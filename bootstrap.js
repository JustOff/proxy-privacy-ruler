var Cc = Components.classes, Ci = Components.interfaces, Cu = Components.utils;
Cu.import("resource://gre/modules/Services.jsm");

var branch = "extensions.pxruler.";
var protocolProxyService = Cc["@mozilla.org/network/protocol-proxy-service;1"].getService(Ci.nsIProtocolProxyService);
var styleSheetService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
var styleSheetURI = Services.io.newURI("chrome://pxruler/skin/pxruler.css", null, null);
var isEnabled, filterPos = 8888, onPrivate, onList, domRegex = null, gWindowListener;

function listTest(host) {
	if (domRegex === null) {
		try {
			var domList = Services.prefs.getBranch(branch).getCharPref("domList");
			domRegex = new RegExp("^([A-Za-z0-9_-]+\.)?(" + domList.replace(/;/g,"|").replace(/\./g,"\\.") + ")$");
		} catch (e) {}
	}
	return domRegex.test(host);
}

var channelFilter = {
	applyFilter : function(aProxyService, aChannel, aProxy) {
		var result = null;
		if (aChannel.URI.host == "nwi.anonymox.net" || aChannel.URI.host == "hoxx.com") {
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
			toolbar = toolbarId && $(doc, toolbarId),
			nextItem = toolbar && $(doc, nextItemId);
		if (toolbar) {
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
			w.setToolbarVisibility(toolbar, true);
		}
		return b;
	},
	onCustomize : function(e) {
		var ucs = Services.prefs.getCharPref("browser.uiCustomization.state");
		if ((/\"nav\-bar\"\:\[.*?\"pxruler\-button\".*?\]/).test(ucs)) {
			Services.prefs.getBranch(branch).setCharPref("toolbarId", "nav-bar");
		} else {
			button.setPrefs(null, null);
		}
	},
	afterCustomize : function(e) {
		var toolbox = e.target,
			b = $(toolbox.parentNode, button.meta.id),
			toolbarId, nextItemId;
		if (b) {
			var parent = b.parentNode,
				nextItem = b.nextSibling;
			if (parent && (parent.localName == "toolbar" || parent.classList.contains("customization-target"))) {
				toolbarId = parent.id;
				nextItemId = nextItem && nextItem.id;
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
		run : function() {
			Services.prefs.getBranch(branch).setBoolPref("isEnabled", !isEnabled);
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
				var domList = Services.prefs.getBranch(branch).getCharPref("domList");
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
