/*  Copyright (c) 2009, Mozilla Foundation
 *  All rights reserved. 
 *  http://opensource.org/licenses/BSD-3-Clause
 */

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

var EXPORTED_SYMBOLS = ["PrefLoader"];

var PrefLoader = {};
PrefLoader.prefDomain = "extensions.pxruler.";

function loadDefaultPrefs(path, fileName)
{
	try
	{
		var uri;
		var baseURI = Services.io.newFileURI(path);

		if (path.isDirectory())
			uri = Services.io.newURI("defaults/preferences/" + fileName, null, baseURI).spec;
		else
			uri = "jar:" + baseURI.spec + "!/defaults/preferences/" + fileName;

		Services.scriptloader.loadSubScript(uri, {pref: pref});
	}
	catch (err)
	{
		Cu.reportError(err);
	}
}

function clearDefaultPrefs(domain)
{
	domain = domain || PrefLoader.prefDomain;
	var pb = Services.prefs.getDefaultBranch(domain);

	var names = pb.getChildList("");
	for (var i=0; i<names.length; i++)
	{
		var name = names[i];
		if (!pb.prefHasUserValue(name))
			pb.deleteBranch(name);
	}
}

function pref(name, value)
{
	try
	{
		var branch = Services.prefs.getDefaultBranch("");

		switch (typeof value)
		{
			case "boolean":
				branch.setBoolPref(name, value);
				break;

			case "number":
				branch.setIntPref(name, value);
				break;

			case "string":
				var str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
				str.data = value;
				branch.setComplexValue(name, Ci.nsISupportsString, str);
				break;
		}
	}
	catch (e)
	{
		Cu.reportError("prefLoader.pref; Firebug can't set default pref value for: " + name);
	}
}

var prefTypeMap = (function()
{
	var map = {}, br = Ci.nsIPrefBranch;
	map["string"] = map[br.PREF_STRING] = "CharPref";
	map["boolean"] = map[br.PREF_BOOL] = "BoolPref";
	map["number"] = map[br.PREF_INT] = "IntPref";
	return map;
})();

function getPref(prefDomain, name)
{
	var prefName = (name == undefined) ?
		PrefLoader.prefDomain + prefDomain : prefDomain + "." + name;
	var prefs = Services.prefs;
	var type = prefTypeMap[prefs.getPrefType(prefName)];
	return type ? prefs["get" + type](prefName) : null;
}

function setPref(name, value)
{
	var prefName = PrefLoader.prefDomain + name;
	var prefs = Services.prefs;

	var type = prefTypeMap[typeof value];
	if (type)
		value = prefs["set" + type](prefName, value);

	return value;
}

function forceSave()
{
	Services.prefs.savePrefFile(null);
}

PrefLoader.loadDefaultPrefs = loadDefaultPrefs;
PrefLoader.clearDefaultPrefs = clearDefaultPrefs;
PrefLoader.getPref = getPref;
PrefLoader.setPref = setPref;
PrefLoader.forceSave = forceSave;
