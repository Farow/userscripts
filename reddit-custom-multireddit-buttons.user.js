// ==UserScript==
// @name        Reddit custom multireddit buttons
// @namespace   https://github.com/Farow/userscripts
// @description Adds custom buttons to the multireddit list
// @include     /^https?:\/\/[a-z]+\.reddit\.com\/(?:explore|user\/[\da-z_]+\/saved|r\/(?:all|mod))?/
// @version     1.00
// @grant       none
// ==/UserScript==

"use strict";

var make_smaller          = 1; /* makes the buttons above the multireddit list have the same size as the multireddit buttons */
var remove_subscribed     = 1;
var remove_explore        = 1;
var remove_explore_multis = 1;
var remove_create_multi   = 1;
var remove_other          = 0; /* remove all other buttons below the multireddit list (everything, moderating, saved) */

var custom_buttons        = {
	"everything": "/r/all/",
	"saved":      "/user/user/saved/",
};

function create_buttons (buttons) {
	var global  = document.getElementsByClassName("global")[0];
	var buttons = global.children;
	
	/* live list, remove backwards so as not to skip elements */
	for (let i = buttons.length - 1; i > -1; i--) {
		if (buttons[i].firstChild.getAttribute("href") == "/" && remove_subscribed) {
			global.removeChild(buttons[i]);
		}
		else if (buttons[i].firstChild.getAttribute("href") == "/explore" && remove_explore) {
			global.removeChild(buttons[i]);
		}
	}

	/* this one is in the multis list, second to last */
	if (remove_explore_multis) {
		let multis = document.getElementsByClassName("multis")[0];

		multis.removeChild(multis.children[ multis.children.length - 2 ]);
	}

	if (remove_explore_multis) {
		let multis = document.getElementsByClassName("multis")[0];

		multis.removeChild(multis.children[ multis.children.length - 1 ]);
	}

	/* remove other links */
	if (remove_other) {
		let other = document.getElementsByClassName("other")[0];
		other.parentNode.removeChild(other);
	}

	/* add custom buttons */
	for (let name in custom_buttons) {
		create_button(name, custom_buttons[name]);
	}

	/* apply multi css to global links */
	if (make_smaller) {
		global.classList.remove("global");
		global.classList.add("multis");
		global.style.setProperty("margin-top", "10px");
	}

	/* apply selected style to custom links */
	for (let i = 0; i < buttons.length; i++) {
		let button_url   = buttons[i].firstChild.href;

		/* remove trailing slash */
		if (button_url.substr(-1) == '/') {
			button_url = button_url.slice(0, -1);
		}

		if (document.URL.indexOf(button_url) > -1) {
			buttons[i].classList.add("selected");
			break;
		}
	}
}

function create_button (name, url) {
	var button = document.createElement("li");
	var link   = document.createElement("a");

	link.textContent = name;
	link.href        = url;

	button.appendChild(link);

	document.getElementsByClassName("global")[0].appendChild(button);
}

try {
	create_buttons(custom_buttons);
}
catch (e) {
	console.log(e.message);
}
