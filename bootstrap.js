var Cc = Components.classes, Ci = Components.interfaces, Cu = Components.utils;
Cu.import("resource://gre/modules/Services.jsm");

var protocolProxyService = Cc["@mozilla.org/network/protocol-proxy-service;1"].getService(Ci.nsIProtocolProxyService);
var onPrivate, onList, domRegex = null;

function listTest(host) {
	if (domRegex === null) {
		try {
			var domList = Services.prefs.getCharPref("extensions.pxruler.domList");
			domRegex = new RegExp("^([A-Za-z0-9_-]+\.)?(" + domList.replace(/;/g,"|").replace(/\./g,"\\.") + ")$");
		} catch (e) {}
	}
	return domRegex.test(host);
}

var channelFilter = {
	applyFilter : function (aProxyService, aChannel, aProxy) {
		var result = null;
		if (aChannel.URI.host == "nwi.anonymox.net") {
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

var myPrefsWatcher = {
	observe: function (subject, topic, data) {
		if (topic != "nsPref:changed") return;
		switch (data) {
			case "onPrivate":
				onPrivate = Services.prefs.getBoolPref("extensions.pxruler.onPrivate");
				break;
			case "onList":
				onList = Services.prefs.getBoolPref("extensions.pxruler.onList");
				break;
			case "domList":
				var domList = Services.prefs.getCharPref("extensions.pxruler.domList");
				if (domList == "") {
					Services.prefs.clearUserPref("extensions.pxruler.domList");
				}
				domRegex = null;
				break;
		}
	},
	register: function () {
		var prefsService = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
		this.prefBranch = prefsService.getBranch("extensions.pxruler.");
		this.prefBranch.addObserver("", this, false);
	},
	unregister: function () {
		this.prefBranch.removeObserver("", this);
	}
}


function startup(aData, aReason) {
		Cu.import("chrome://pxruler/content/prefloader.js");
		PrefLoader.loadDefaultPrefs(aData.installPath, "pxruler.js");
		
		onPrivate = Services.prefs.getBoolPref("extensions.pxruler.onPrivate");
		onList = Services.prefs.getBoolPref("extensions.pxruler.onList");
		listTest();
		
		protocolProxyService.registerChannelFilter(channelFilter, 8888);
		myPrefsWatcher.register();
}

function shutdown(aData, aReason) {
		myPrefsWatcher.unregister();
		protocolProxyService.unregisterChannelFilter(channelFilter);
		
		Cu.unload("chrome://pxruler/content/prefloader.js");
}

function install(aData, aReason) {}
function uninstall(aData, aReason) {}
