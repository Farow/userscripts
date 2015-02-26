// ==UserScript==
// @name        Reddit highlight new comments
// @namespace   https://github.com/Farow/userscripts
// @description Highlights new comments since your last visit
// @include     /https?:\/\/[a-z]+\.reddit\.com\/r\/[\w:+-]+\/comments\/[\da-z]/
// @version     1.0.2
// @require     https://raw.githubusercontent.com/bgrins/TinyColor/master/tinycolor.js
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_listValues
// ==/UserScript==

'use strict';

/*
	This similar to JonnyRobbie's script (https://greasyfork.org/scripts/1868-reddit-highlight-newest-comments)
	with the following differences:
		- supports most subdomains and subreddits
		- no longer need to reload the page when setting a newer highlight time
		- the whole comment is now highlighted, not just the text (I believe this is how JonnyRobbie's script
		  used to work a long time ago)
		- comment edit time is prefered over creation time (by default)
		- better comments are only highlighted if the parent comment has a non-negative score
		- removed gold related code (no way for me to test it)
		- using GM_* to store times instead of localStorage (this way reddit and other userscripts/extensions
		  cannot access this script's storage)

	Changelog:

		2015-02-20 - 1.0.2 - added option to use either this script's or reddit's comment highlighting
		2014-09-10 - 1.0.1 - no longer highlights your own comments
		2014-08-31 - 1.0.0 - initial release
*/

/* settings */
var highlight_edited      = true;                /* highlight edited comments since last visit */
var default_highlighting  = false;               /* if true this script does nothing wherever comment highlighting */
                                                 /* is available, otherwise hides the default highlighting */

var highlight_better      = true;                /* highlight child comments with more karma than their parents */
var highlight_negative    = true;                /* highlight comments with negative karma */

var border_style_new      = '1px solid #53A1EF'; /* border style of new comments */
var border_style_better   = '2px solid #53A1EF'; /* border style of "better" child comments */
var border_style_negative = '2px solid #FA8072'; /* border style of negative comments */

/* colors (only apply to new comments) */
var color_newest = 'hsl(210, 100%, 75%)'; /* background color of newest comments */
var color_newer  = 'hsl(210, 100%, 90%)'; /* background color of newer comments */
var time_span    = 8;                     /* time span between newest and newer comments, in hours */

/*
	Short explanation of colors: any comments created between now and "time_span"
	will have a value between "color_newest" and "color_newer."
	If you need help with hsl, use an hsl color picker, such as: http://hslpicker.com/
*/

/* "advanced" settings */
var expiration = 7 * 24 * 60 * 60 * 1000; /* cache expiration in miliseconds (1 week)*/

var has_gold;
init();

function init() {
	/* check if we're actually on a comment page */
	if (!document.getElementsByTagName('body')[0].classList.contains('comments-page')) {
		return;
	}

	let thread_id  = (document.getElementById('siteTable').firstChild.className.match(/id-(t3_[^ ]+)/))[1],
		last_visit = GM_getValue(thread_id),
		highlight  = 1;
		has_gold   = document.getElementsByClassName('comment-visits-box')[0] ? true : false;

	purge_old_storage();

	/* visting for the first time */
	if (last_visit === undefined) {
		last_visit = Date.now();
		highlight  = 0; /* don't highlight comments that were created just now */
		GM_setValue(thread_id, last_visit);
	}

	create_comment_highlighter(thread_id, last_visit);

	if (highlight) {
		highlight_comments(last_visit);
	}

	/* don't reset the last visited time if we're on a single comment's thread */
	if (!/^https?:\/\/[a-zA-Z]+\.reddit\.com\/r\/[\w:+-]+\/comments\/[\da-z]+\/[\da-z_]+\/?(?:\?sort=.+)?$/.test(document.URL)) {
		return;
	}

	GM_setValue(thread_id, Date.now());
}

function highlight_comments(last_visit) {
	let comments     = document.getElementsByClassName('comment'),
		new_comments = 0,
		username;

	if (has_gold && default_highlighting) {
		return;
	}

	if (document.body.classList.contains('loggedin')) {
		username = document.getElementsByClassName('user')[0].firstElementChild.textContent;
	}

	for (let i = 0; i < comments.length; i++) {
		/* current comment data */
		let comment    = comments[i];
		let comment_id = comment.dataset.fullname;

		/* skip removed or deleted comments */
		if (comment.classList.contains('deleted') || comment.classList.contains('spam')) {
			continue;
		}

		/* skip our own comments */
		let author = comment.getElementsByClassName('author')[0].textContent;
		if (username && username == author) {
			continue;
		}

		if (has_gold && !default_highlighting) {
			comment.setAttribute('class', comment.getAttribute('class').replace(/comment-period-\d+/, ''));
		}

		/* times  = [creation time, edit time] */
		let times = document.getElementsByClassName('id-' + comment_id)[0].getElementsByClassName('tagline')[0].getElementsByTagName('time');
		let time  = Date.parse(times[highlight_edited ? times.length - 1 : 0].dateTime);

		let score = get_comment_score(comment);

		/* parent comment data */
		let parent = comment.parentNode.parentNode.parentNode;
		let parent_id, parent_score;

		if (parent.classList.contains('comment') && !parent.classList.contains('deleted') && !parent.classList.contains('spam')) {
			parent_id    = parent.dataset.fullname;
			parent_score = get_comment_score(parent);
		}

		/* new comments */
		if (time > last_visit) {
			comment.style.setProperty('background-color', get_color(Date.now() - time), 'important');
			comment.style.setProperty('border', border_style_new, 'important');
			new_comments++;
		}
		/* better comments */
		if (parent_id && highlight_better && parent_score > -1 && score > parent_score) {
			comment.style.setProperty('border-left', border_style_better, 'important');
		}
		/* negative comments */
		else if (highlight_negative && score < 0) {
			comment.style.setProperty('border-left', border_style_negative, 'important');
		}
	}
}

function reset_highlighted_comments() {
	let comments = document.getElementsByClassName('comment');

	for (let i = 0; i < comments.length; i++) {
		comments[i].style.removeProperty('background-color');
		comments[i].style.removeProperty('border');
	}
}

function create_comment_highlighter(thread_id, last_visit) {
	let comment_margin,
		commentarea      = document.getElementsByClassName('commentarea')[0],
		sitetable        = commentarea.getElementsByClassName('sitetable')[0],
		difference       = Date.now() - last_visit,
		highlighter      = document.createElement('div'),
		title            = document.createElement('div'),
		description      = document.createElement('span'),
		input            = document.createElement('input'),
		highlight        = document.createElement('input'),
		gold_highlighter = document.getElementsByClassName('comment-visits-box')[0];

	if (sitetable.firstChild.id == 'noresults') {
		return;
	}

	if (gold_highlighter) {
		if (!default_highlighting) {
			gold_highlighter.parentNode.removeChild(gold_highlighter);
		}
		else {
			return;
		}
	}

	/* get the margin-left of the first comment so that the highlighter has the same margin */
	comment_margin = window.getComputedStyle(sitetable.firstChild).getPropertyValue('margin-left');

	highlighter.classList.add('gold-accent', 'comment-visits-box'); /* apply reddit's default styles */
	highlighter.style.setProperty('margin-left', comment_margin);

	title.classList.add('title');
	description.textContent = 'Highlight comments since (hh:mm ago):';

	input.type  = 'text';
	input.id    = 'timeInput';
	input.value =
		pad(Math.floor(difference / 1000 / 3600), 2) + ':' + /* div for hours */
		pad(Math.floor(difference / 1000 % 3600 / 60), 2);               /* mod for minutes */
	input.style.setProperty('text-align', 'right');
	input.style.setProperty('margin', 'auto 5px');
	input.style.setProperty('width', '50px');
	input.style.setProperty('height', '20px'); /* same as the highlight button */

	highlight.type  = 'button';
	highlight.value = 'highlight';
	highlight.addEventListener('click', function() {
		set_last_visit_time(thread_id, get_time(input.value));
	});

	title.appendChild(description);
	title.appendChild(input);
	title.appendChild(highlight);

	highlighter.appendChild(title);

	commentarea.insertBefore(highlighter, sitetable);
}

function set_last_visit_time(thread_id, time) {
	if (time === null) {
		alert('Invalid time format, use hh:mm.');
		return;
	}

	let last_visit = Date.now() - time;
	GM_setValue(thread_id, last_visit);

	reset_highlighted_comments();
	highlight_comments(last_visit);
}

function purge_old_storage() {
	let now     = Date.now(),
		removed = 0;

	GM_listValues().forEach(function (id, index) {
		if (GM_getValue(id) + expiration < now) {
			GM_deleteValue(id);
			removed++;
		}
	});
}

function get_comment_score(comment) {
	let scores = comment.getElementsByClassName('tagline')[0].getElementsByClassName('unvoted');

	if (scores.length === 0) {
		return 0; /* hidden */
	}

	let score = parseInt(scores[0].textContent, 10),
		voted = comment.firstChild.nextSibling;

	if (voted.classList.contains('likes')) {
		score++;
	}
	else if (voted.classList.contains('dislikes')) {
		score--;
	}

	return score;
}

function get_time(text) {
	if (/^[\d]+:(?:[0-9]|[1-5][0-9]|60)+$/.test(text)) {
		let [hours, minutes] = text.split(":");

		return (parseInt(hours) * 60 + parseInt(minutes)) * 60 * 1000;
	}

	return null;
}

function get_color(difference) {
	if (difference > time_span * 3600 * 1000 - 1) {
		return color_newer;
	}

	let time_diff = 1 - difference / (time_span * 3600 * 1000),
		color_a   = tinycolor(color_newest).toHsl(),
		color_b   = tinycolor(color_newer).toHsl();

	let color_final = tinycolor({
		h: color_b.h + (color_a.h - color_b.h) * time_diff,
		s: color_b.s + (color_a.s - color_b.s) * time_diff,
		l: color_b.l + (color_a.l - color_b.l) * time_diff,
	});

	return color_final.toHslString();
}

function pad(number, width, char) {
	char   = char || '0';
	number = number + ''; /* force string */
	return number.length > width - 1 ? number : new Array(width - number.length + 1).join(char) + number;
}
