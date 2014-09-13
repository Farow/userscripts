// ==UserScript==
// @name        Reddit fade seen links
// @namespace   https://github.com/Farow/userscripts
// @description Fades links that you have already seen
// @include     /https?:\/\/[a-z]+\.reddit\.com\//
// @include     https://news.ycombinator.com/*
// @include     https://lobste.rs/*
// @include     https://openuserjs.org/*
// @version     1.03
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_listValues
// @grant       GM_addStyle
// @grant       GM_registerMenuCommand
// ==/UserScript==

'use strict';

/*
	Changelog:

		2014-09-13 - 1.03
			- added support for openuserjs.org
			- added support for styling new links
			- moved some options to css style to allow easier styling
			- added remove styles command
			- clear last now only works for the links that you saw on your last page,
			  not all the links that you have seen once
		2014-09-06 - 1.02
			- added support for news.ycombinator.com and lobste.rs
			- old links are now removed from storage depending on their last visit time, not first visit time
		2014-09-02 - 1.01 - no longer fades links or comments on a profile page
		2014-09-02 - 1.00 - initial release
*/

let opacity    = 0.5, /* opacity of seen links */
	hide_after = 0,   /* times seen a link before hiding it (0 to never hide links) */
	expiration = 2;   /* time after which to remove old links from storage, in days */

GM_addStyle(
	  '.fade { opacity: ' + opacity + '; }'
	+ '.dupe { opacity: 0.85; }'
	+ '.hide { display: none; }'
	+ '.new  { box-shadow: -2px 0px 0px 0px hsl(210, 100%, 75%); }'
);


/* compatibility with scripts that modify links */
window.addEventListener('load', init);

let rules = {
	'news.ycombinator.com': {
		'links': function () {
			/* exclude 'more' and comment pages */
			return [].slice.call(document.querySelectorAll('td.title a'), 0, -1);
		},
		'parents': function (link) {
			return [ link.parentNode.parentNode, link.parentNode.parentNode.nextSibling ];
		},
	},
	'reddit.com': {
		'include': function () {
			return document.body.classList.contains('listing-page');
		},
		'exclude': function () {
			return document.body.classList.contains('profile-page');
		},
		'links': '.thing.link > .entry a.title',
		'parents': function (link) {
			return [ link.parentNode.parentNode.parentNode ];
		},
		'style': '.fade, .dupe { overflow: hidden; }',
	},
	'lobste.rs': {
		'exclude': function () {
			return document.querySelector('.comments');
		},
		'links': '.link a',
		'parents': function (link) {
			return [ link.parentNode.parentNode.parentNode ];
		}
	},
	'openuserjs.org': {
		'links': 'a.tr-link-a',
		'parents': function(link) {
			return [ link.parentNode.parentNode ];
		}
	},
};

function init() {
	let site;
	for (site in rules) {
		let site_tokens   = site.split('.'),
			domain_tokens = location.hostname.split('.').slice(-site_tokens.length);

		if (equal_arrays(site_tokens, domain_tokens)) {
			site = rules[site];
			break;
		}
	}

	if (site === undefined) {
		return;
	}

	if (site.hasOwnProperty('include') && !site.include()) {
		return;
	}

	if (site.hasOwnProperty('exclude') && site.exclude()) {
		return;
	}

	GM_registerMenuCommand("Fade links: clear all", clear.bind(undefined, 0));
	GM_registerMenuCommand("Fade links: clear last", clear.bind(undefined, 1));
	GM_registerMenuCommand("Fade links: remove styles", remove_styles.bind(undefined, site));
	GM_registerMenuCommand("Fade links: hide seen", check_links.bind(undefined, site, 1));

	remove_old();
	check_links(site);
}

function check_links(site, on_demand_hide) {
	let old   = get_links_in_storage(),
		links = get_links_in_page(site);

	links.forEach(function (element) {
		let url = element.href;

		if (on_demand_hide) {
			if (old.hasOwnProperty(url) && old[url].seen > 0) {
				fade(site, element, 0, 0, 1); /* force */
			}
		}
		else if (!old.hasOwnProperty(url)) {
			old[url] = {
				seen: 0,
				last: 1,
				when: Date.now(),
				accessed: 1
			};

			let parents = get_parents(site, element);
			for (let i = 0; i < parents.length; i++) {
				parents[i].classList.add('new');
			}
		}
		else {
			old[url].when = Date.now();

			if (old[url].accessed) {
				fade(site, element, old[url].seen, 1);
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

			fade(site, element, old[url].seen);
		}
	});

	for (let url in old) {
		if (old[url].accessed) {
			delete old[url].accessed;
		}
		else if (old[url].last == 2) {
			old[url].last = 0;
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

function fade(site, link, seen, is_dupe, force_hide) {
	let parents = get_parents(site, link);
	if (force_hide || (hide_after !== 0 && seen > hide_after - 1)) {
		for (let i = 0; i < parents.length; i++) {
			parents[i].classList.add('hide');
		}

		return;
	}

	for (let i = 0; i < parents.length; i++) {
		if (seen) {
			parents[i].classList.add('fade');
		}
		else if (is_dupe) {
			parents[i].classList.add('dupe');
		}

		if (site.style) {
			GM_addStyle(site.style);
		}
	}
}

function remove_styles(site) {
	let links = get_links_in_page(site);

	links.forEach(function (element) {
		let parents = get_parents(site, element);
		for (let i = 0; i < parents.length; i++) {
			parents[i].classList.remove('fade', 'dupe', 'hide', 'new');
		}
	});
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

function get_links_in_page(site) {
	if (typeof site.links == 'function') {
		return site.links();
	}

	return [].slice.call(document.querySelectorAll(site.links));
}

function get_links_in_storage() {
	let links = GM_getValue('links');

	if (links === undefined) {
		return { };
	}

	return JSON.parse(links);
}

function get_parents(site, link) {
	if (site.hasOwnProperty('parents')) {
		return site.parents(link);
	}

	return link;
}

function save_links(links) {
	GM_setValue('links', JSON.stringify(links));
}

function equal_arrays(a, b) {
	if (a === b) {
		return true;
	}
	if (a == null || b == null || a.length != b.length) {
		return false;
	}

	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}

	return true;
}
