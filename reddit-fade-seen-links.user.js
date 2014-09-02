// ==UserScript==
// @name        Reddit fade seen links
// @namespace   https://github.com/Farow/userscripts
// @description Fades links that you have already seen
// @include     /https?:\/\/[a-z]+\.reddit\.com\//
// @version     1.00
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_listValues
// @grant       GM_registerMenuCommand
// ==/UserScript==

'use strict';

/*
	Changelog:

		2013-09-02 - 1.00 - Initial release
*/

let start      = 0.5, /* initial opacity of seen links */
	step       = 0,   /* opacity decrease for every time you have seen a link */
	hide_after = 0,   /* times seen a link before hiding it (0 to never hide links) */
	fade_dupes = 1,   /* fade any links that appear more than once */
	expiration = 2;   /* time after which to remove old links from storage, in days */

/* compatibility with RES which modifies some links */
window.addEventListener('load', init);

function init() {
	if (!document.body.classList.contains('listing-page')) {
		return;
	}

	GM_registerMenuCommand("Fade links: clear all", clear.bind(undefined, 0));
	GM_registerMenuCommand("Fade links: clear last", clear.bind(undefined, 1));
	GM_registerMenuCommand("Fade links: hide seen", check_links.bind(undefined, 1));

	remove_old();
	check_links();
}

function check_links(on_demand_hide) {
	let old   = get_links_in_storage(),
		links = get_links_in_page();
		

	links.forEach(function (element) {
		let url = element.href;

		if (on_demand_hide) {
			if (old.hasOwnProperty(url) && old[url].seen > 0) {
				fade(element, 0, 0, 1); /* force */
			}
		}
		else if (!old.hasOwnProperty(url)) {
			old[url] = {
				seen: 0,
				last: 1,
				when: Date.now(),
				accessed: 1
			};
		}
		else {
			if (old[url].accessed) {
				fade(element, old[url].seen, 1);
				return;
			}

			old[url].accessed = 1;
			old[url].seen++;

			if (old[url].last == 1) {
				old[url].last++;
			}
			else if (old[url].last) {
				old[url].last = 0;
			}

			fade(element, old[url].seen);
		}
	});

	for (let url in old) {
		if (old[url].accessed) {
			delete old[url].accessed;
		}
	}

	save_links(old);
}

function clear(last) {
	if (last) {
		let links = get_links_in_storage();

		for (let url in links) {
			if (links[url].last == 2) {
				delete links[url];
			}
		}

		save_links(links);
		return;
	}

	save_links({});
}

function fade(element, seen, is_dupe, force_hide) {
	if (force_hide || (hide_after !== 0 && seen > hide_after - 1)) {
		element.parentNode.parentNode.parentNode.style.setProperty('display', 'none');
		return;
	}

	if (is_dupe && fade_dupes) {
		seen++;
	}

	if (seen) {
		let opacity = start - step * (seen - 1);
		if (opacity < 0) {
			opacity = 0.05
		}

		element.parentNode.parentNode.parentNode.style.setProperty('opacity', opacity);
	}
}

function remove_old() {
	let links = get_links_in_storage(),
		diff  = Date.now() - expiration * 86400000, /* 1 day */
		i     = 0;

	for (let url in links) {
		if (links[url].when < diff) {
			delete links[url];
			i++;
		}
	}
	if (i) {
		save_links(links);
	}
}

function get_links_in_page() {
	return [].slice.call(document.getElementsByTagName('a')).filter(function (element) {
		return element.classList.contains('title');
	});
}

function get_links_in_storage() {
	let links = GM_getValue('links');

	if (links === undefined) {
		return { };
	}
	return JSON.parse(links);
}

function save_links(links) {
	GM_setValue('links', JSON.stringify(links));
}
