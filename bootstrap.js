var Cc = Components.classes, Ci = Components.interfaces, Cu = Components.utils;
Cu.import("resource://gre/modules/Services.jsm");

var aProxyService = Cc["@mozilla.org/network/protocol-proxy-service;1"].getService(Ci.nsIProtocolProxyService);
var onPrivate, onList, domList, domRegex = null;

function listTest(host) {
	if (domRegex === null) {
		try {
			domRegex = new RegExp("^([A-Za-z0-9_-]+\.)?(" + domList.replace(/;/g,"|").replace(/\./g,"\\.") + ")$");
//			Cu.reportError(domRegex);
		} catch (e) {}
	}
//	Cu.reportError(domRegex.test(host));
	return domRegex.test(host);
}

var cf = {
	applyFilter : function (aProxyService, aChannel, aProxy) {
//		Cu.reportError(aChannel.URI.spec);
		var result = null;
		if (aChannel.URI.host == "nwi.anonymox.net") {
			result = aProxy;
		} else if (onPrivate) {
			aChannel.QueryInterface(Ci.nsIPrivateBrowsingChannel);
//			Cu.reportError(aChannel.isChannelPrivate);
			if (aChannel.isChannelPrivate) {
				if (onList) {
					if (listTest(aChannel.URI.host)) {
						result = aProxy;
					}
				} else {
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
//		Cu.reportError(result);
		return result;
	}
}

var myPrefsWatcher = {
	observe: function (subject, topic, data) {
		if (topic != "nsPref:changed") return;
		switch (data) {
			case "onPrivate":
				onPrivate = Services.prefs.getBoolPref("extensions.pxruler.onPrivate");
				if (onPrivate) {
					Services.prefs.setBoolPref("extensions.pxruler.onList", false);
				}
				break;
			case "onList":
				onList = Services.prefs.getBoolPref("extensions.pxruler.onList");
				if (onList) {
					Services.prefs.setBoolPref("extensions.pxruler.onPrivate", false);
				}
				break;
			case "domList":
				domList = Services.prefs.getCharPref("extensions.pxruler.domList");
				if (domList == "") {
					Services.prefs.clearUserPref("extensions.pxruler.domList");
					domList = Services.prefs.getCharPref("extensions.pxruler.domList");
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
		domList = Services.prefs.getCharPref("extensions.pxruler.domList");
		try {
			domRegex = new RegExp("^([A-Za-z0-9_-]+\.)?(" + domList.replace(/;/g,"|").replace(/\./g,"\\.") + ")$");
		} catch (e) {}
		
		aProxyService.registerChannelFilter(cf, 8888);
		myPrefsWatcher.register();
}

function shutdown(aData, aReason) {
		myPrefsWatcher.unregister();
		aProxyService.unregisterChannelFilter(cf);
		Cu.unload("chrome://pxruler/content/prefloader.js");
}

function install(aData, aReason) {}
function uninstall(aData, aReason) {}
