// ==UserScript==
// @name        Reddit fade seen links
// @namespace   https://github.com/Farow/userscripts
// @description Fades links that you have already seen
// @include     /https?:\/\/[a-z]+\.reddit\.com\//
// @include     https://news.ycombinator.com/*
// @include     https://lobste.rs/*
// @include     https://openuserjs.org/*
// @version     1.0.5
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

		2014-09-19 - 1.0.5
			- added live feedback on hover/click
			- added clear all on this page command
			- added fade_mode option
			- improved hiding non-script links on openuserjs.org
			- removed opacity option
		2014-09-14 - 1.0.4
			- added a hide seen button
			- improved support for hacker news
		2014-09-13 - 1.0.3
			- added support for openuserjs.org
			- added support for styling new links
			- moved some options to css style to allow easier styling
			- added remove styles command
			- clear last now only works for the links that you saw on your last page,
			  not all the links that you have seen once
		2014-09-06 - 1.0.2
			- added support for news.ycombinator.com and lobste.rs
			- old links are now removed from storage depending on their last visit time, not first visit time
		2014-09-02 - 1.0.1 - no longer fades links or comments on a profile page
		2014-09-02 - 1.0.0 - initial release
*/

let fade_mode  = 2,   /* 1: automatically fade all links, 2: fade hovered links, 3: fade clicked links */
	hide_after = 0,   /* times seen a link before hiding it (0 to never hide links) */
	expiration = 2,   /* time after which to remove old links from storage, in days */
	style      =
		  '.fade { opacity: 0.5; transition: opacity 1s ease-in-out; }'
		+ '.dupe { opacity: 0.85; box-shadow: -2px 0px 0px 0px hsl(210, 100%, 90%); }'
		+ '.hide { display: none; }'
		+ '.new  { box-shadow: -2px 0px 0px 0px hsl(210, 100%, 75%); }'
;

/* compatibility with scripts that modify links */
window.addEventListener('load', init);

let rules = {
	'news.ycombinator.com': {
		'links': function () {
			/* exclude 'more' and comment pages */
			return [].slice.call(document.querySelectorAll('td.title a'), 0, -1);
		},
		'parents': function (link) {
			return [ link.parentNode.parentNode, link.parentNode.parentNode.nextSibling, link.parentNode.parentNode.nextSibling.nextSibling ];
		},
		'hide_button': function () {
			let a = document.createElement('a');

			a.href = '#';
			a.textContent = 'hide seen';

			document.getElementsByClassName('pagetop')[0].innerHTML += ' | ';

			return ['.pagetop', a];
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
		'hide_button': function () {
			let li = document.createElement('li'),
				a  = document.createElement('a');

			a.href = '#';
			a.textContent = 'hide seen';
			a.classList.add('choice');

			li.appendChild(a);

			return [ '.tabmenu', li ];
		},
	},
	'lobste.rs': {
		'exclude': function () {
			return document.querySelector('.comments');
		},
		'links': '.link a',
		'parents': function (link) {
			return [ link.parentNode.parentNode.parentNode ];
		},
		'hide_button': function () {
			let a = document.createElement('a');

			a.href = '#';
			a.textContent = 'Hide seen';

			return ['.headerlinks', a];
		},
	},
	'openuserjs.org': {
		'links': 'a.tr-link-a',
		'parents': function(link) {
			/* script links */
			let parent = link.parentNode.parentNode;

			/* any other links */
			if (!/^https:\/\/openuserjs\.org\/scripts\//.test(link.href)) {
				parent = parent.parentNode;
			}

			return [ parent ];
		},
		'hide_button': function (){
			let li = document.createElement('li'),
				a  = document.createElement('a');

			a.href = '#';
			a.textContent = 'Hide seen';

			li.appendChild(a);

			return ['ul.navbar-right', li, document.getElementsByClassName('navbar-right')[0].lastElementChild.previousElementSibling];
		},
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

	if (!site.hasOwnProperty('remove_default_styles')) {
		GM_addStyle(style);
	}

	if (site.hasOwnProperty('hide_button')) {
		let [where, button, insert_before] = site.hide_button();
		let element = document.querySelector(where);

		if (element) {
			if (insert_before) {
				element.insertBefore(button, insert_before);
			}
			else {
				element.appendChild(button);
			}
			
			button.addEventListener('click', function (event) {
				check_links(site, 1);
				event.preventDefault();
			});
		}
	}

	GM_registerMenuCommand('Fade links: clear all', clear.bind(undefined, 0, site));
	GM_registerMenuCommand('Fade links: clear on this page', clear.bind(undefined, 1, site));
	GM_registerMenuCommand('Fade links: clear last', clear.bind(undefined, 2, site));
	GM_registerMenuCommand('Fade links: remove styles', remove_styles.bind(undefined, site));
	GM_registerMenuCommand('Fade links: hide seen', check_links.bind(undefined, site, 1));

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

			return;
		}

		if (!old.hasOwnProperty(url)) {
			/* mark new */
			let parents = get_parents(site, element);
			for (let i = 0; i < parents.length; i++) {
				parents[i].classList.add('new');
			}

			/* automatically add to history */
			if (fade_mode === 1) {
				if (!old.hasOwnProperty(url)) {
					old[url] = {
						seen: 0,
						last: 1,
						when: Date.now(),
						accessed: 1,
					};
				}
			}
			/* add to history on hover/click */
			else {
				let capture_event = fade_mode === 2 ? 'mouseover' : 'mouseup';
				element.addEventListener(capture_event, function (e) {
					/* avoid right click and modifier buttons */
					if (e.type === 'mouseup' && (e.button === 2 || e.ctrlKey || e.shiftKey || e.altKey || e.metaKey)) {
						return;
					}

					let url = e.currentTarget.href;
					if (!old.hasOwnProperty(url)) {
						old[url] = {
							seen: 1,
							last: 1,
							when: Date.now(),
							accessed: 1,
						};
					}

					//window.setTimeout(fade, 1000, site, element, old[url].seen);
					fade(site, element, old[url].seen);
					save_links(old);
				});
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

	save_links(old);
}

function clear(clear_type, site) {
	/* clear all */
	if (!clear_type) {
		save_links({});
		return;
	}

	let links = get_links_in_storage();

	/* clear all on this page */
	if (clear_type === 1) {
		let new_links = get_links_in_page(site);

		new_links.forEach(function (element) {
			let url = element.href;

			if (links.hasOwnProperty(url)) {
				delete links[url];
			}
		});
	}
	/* clear last */
	else if (clear_type === 2) {
		for (let url in links) {
			if (links[url].last == 2) {
				delete links[url];
			}
		}
	}

	save_links(links);
	return;

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
	for (let url in links) {
		if (links[url].accessed) {
			delete links[url].accessed;
		}
		else if (links[url].last == 2) {
			links[url].last = 0;
		}
	}

	GM_setValue('links', JSON.stringify(links));
}

function equal_arrays(a, b) {
	if (a === b) {
		return true;
	}
	if (!a || !b || a.length != b.length) {
		return false;
	}

	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}

	return true;
}
