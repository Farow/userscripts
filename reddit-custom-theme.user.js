// ==UserScript==
// @name        Reddit custom theme
// @namespace   https://github.com/Farow/userscripts
// @description Applies a subreddit stylesheet everywhere
// @include     https://*.reddit.com/*
// @version     1.0.0
// @grant       GM_xmlhttpRequest
// @connect     reddit.com
// @connect     redditmedia.com
// @run-at      document-start
// ==/UserScript==

/*
	changelog:

		2016-05-28 - 1.0.0 - initial release
*/

/* subreddit template */
let subreddit  = 'carbon_beta';

/* custom reddit logo */
let snoo_logo  = '//i.imgur.com/4vikRBL.png';

/* css that is applied after the stylesheet */
let custom_css = '.md p { color: #aaaaaa; } [hidden] { display: none !important; }';


let observer       = new MutationObserver(head_monitor);
let stylesheet_url = localStorage.getItem('custom_css_theme');

try {
	init();
}
catch (error) {
	console.log(error);
}

function init () {
	let link    = document.createElement('link');
	let observe = 1;

	link.id     = 'custom_css_theme';
	link.rel    = 'stylesheet';
	link.type   = 'text/css';
	link.href   = stylesheet_url ? stylesheet_url : '/r/' + subreddit + '/stylesheet/';
	link.title  = 'applied_subreddit_stylesheet';

	/* append the custom stylesheet */
	document.head.appendChild(link);

	/* check if subreddit stylesheet has already been loaded */
	for (let node of document.head.children) {
		if (is_stylesheet(node) && node.title == 'applied_subreddit_stylesheet') {
			node.remove();
			observe = 0;
			break;
		}
	}

	/* check for changes to the stylesheet url */
	GM_xmlhttpRequest({
		method: 'GET',
		url: '/r/' + subreddit + '/stylesheet/',
		onload: update_stylesheet_url,
	});

	/* subreddit stylesheet hasn't been added yet */
	if (observe) {
		observer.observe(document.head, { childList: true });
	}

	/* apply final touches after dom loads */
	document.addEventListener('DOMContentLoaded', dom_load);
}

function head_monitor (mutations) {
	for (let mutation of mutations) {
		for (let node of mutation.addedNodes) {
			if (is_stylesheet(node)) {
				/* reddit default theme, move custom theme below it */
				if (node.href.startsWith(window.location.protocol + '//www.redditstatic.com')) {
					let custom_css_theme = document.getElementById('custom_css_theme');
					document.head.appendChild(custom_css_theme);
				}
				/* subreddit theme, remove it */
				else if (node.title == 'applied_subreddit_stylesheet') {
					node.remove();
				}
			}
		}
	}
}

function update_stylesheet_url (response) {
	if (response.status != 200 || stylesheet_url == response.finalUrl) {
		return;
	}

	localStorage.setItem('custom_css_theme', response.finalUrl);

	if (!stylesheet_url) {
		return;
	}

	/* old url was cached, update with new */
	let custom_css_theme = document.getElementById('custom_css_theme');

	if (custom_css_theme) {
		custom_css_theme.href = response.finalUrl;
	}
}

function dom_load () {
	/* no need to monitor <head> anymore */
	observer.disconnect();

	/* reddit's logo image is not part of a subreddit stylesheet, so we need to fix it */
	let header = document.getElementById('header-img');

	if (header) {
		/* on subreddits the logo is an <img> */
		if (header.nodeName == 'IMG') {
			header.src = snoo_logo;
		}
		/* on other pages it's a link with a background image */
		else if (header.nodeName == 'A') {
			header.style.setProperty('background', 'url(' + snoo_logo + ') 0% 0%');
		}
	}

	/* apply custom/user CSS for fixups */
	if (custom_css) {
		add_style(custom_css);
	}
}

function is_stylesheet (node) {
	return node.nodeName == 'LINK' &&
		   node.rel      == 'stylesheet' &&
		   node.id       != 'custom_css_theme'
	;
}

function add_style (css) {
	let style  = document.createElement('style');
	style.type = 'text/css';

	style.appendChild(document.createTextNode(css));
	document.head.appendChild(style);

	return style;
}
