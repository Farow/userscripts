// ==UserScript==
// @name        Reddit comment vote history
// @namespace   https://github.com/Farow/userscripts
// @description Saves the comments you vote on
// @include     /^https?:\/\/[a-z]+\.reddit\.com\/(?:(?:r\/[\da-z_:+-]+\/)?comments|user\/[\da-z_]+)/
// @version     1.0.1
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_listValues
// ==/UserScript==

/*
	changelog:

		2015-05-03 - 1.0.1
			- font size now matches reddit's font size
			- no longer apends a hash at the end of the url
		2014-08-31 - 1.0.0 - initial release
*/

'use strict';

init();

function init() {
	/* create a history button on user profiles */
	if (/^https?:\/\/[a-z]+\.reddit\.com\/user\/[\da-zA-Z_]/.exec(document.URL)) {
		create_history_button();
	}

	let comments = document.getElementsByClassName('comment');
	if (comments.length === 0) {
		return;
	}


	/* register events for upvoting and downvoting comments */
	for (let i = 0; i < comments.length; i++) {
		comments[i].children[1].children[0].addEventListener('click', comment_vote); /* upvote */
		comments[i].children[1].children[1].addEventListener('click', comment_vote); /* downvote */
	}
}

function comment_vote() {
	let comment      = { };
	let comment_node = this.parentNode.parentNode;
	comment.id       = comment_node.dataset.fullname;

	/* upvoted */
	if (this.classList.contains('upmod')) {
		comment.direction = 'up';
	}
	/* downvoted */
	else if (this.classList.contains('downmod')) {
		comment.direction = 'down';
	}
	/* no vote */
	else {
		remove_comment(comment.id);
		return;
	}

	comment.author = comment_node.getElementsByClassName('tagline')[0].getElementsByClassName('author')[0].textContent;
	comment.time   = comment_node.getElementsByClassName('tagline')[0].getElementsByTagName('time')[0].dateTime;
	comment.text   = comment_node.getElementsByClassName('md')[0].innerHTML;
	comment.link   = comment_node.getElementsByClassName('buttons')[0].getElementsByTagName('a')[0].href;

	save_comment(comment);
}

function create_history_button() {
	let tabmenu = document.getElementsByClassName('tabmenu')[0];

	if (tabmenu === undefined) {
		return;
	}


	let button = document.createElement('li');
	let link  = document.createElement('a');

	link.classList.add('choice');
	link.href = '#';
	link.textContent = 'comment vote history';

	button.classList.add('comment-vote-history');
	button.appendChild(link);
	tabmenu.appendChild(button);

	link.addEventListener('click', function (e){
		fix_sorting_menu();
		display_comments('new');

		e.preventDefault();
		e.stopPropagation();
	});
}

function fix_sorting_menu() {
	/* make the sort menu work for the saved comments */
	let dropdown = document.getElementsByClassName('dropdown')[0];

	if (dropdown === undefined) {
		return;
	}

	dropdown.children[0].textContent = 'new';
	dropdown = dropdown.nextSibling;

	/* remove all links */
	while (dropdown.hasChildNodes()){
		dropdown.removeChild(dropdown.lastChild);
	}

	/* create our own */
	let sort_by_new = document.createElement('a'),
		sort_by_old = document.createElement('a');

	sort_by_new.classList.add('choice');
	sort_by_new.textContent = 'new';
	sort_by_new.href = '#';
	sort_by_new.addEventListener('click', function () { set_sort_text(dropdown, 'new'); display_comments('new'); });

	sort_by_old.classList.add('choice');
	sort_by_old.textContent = 'old';
	sort_by_old.href = '#';
	sort_by_old.addEventListener('click', function () { set_sort_text(dropdown, 'old'); display_comments('old'); });

	dropdown.appendChild(sort_by_new);
	dropdown.appendChild(sort_by_old);
}

function set_sort_text(dropdown, sort) {
	dropdown.previousSibling.children[0].textContent = sort;
}

function display_comments(sort_by) {
	let tabmenu    = document.getElementsByClassName('tabmenu')[0];
	let site_table = document.getElementById('siteTable');

	tabmenu.getElementsByClassName('selected')[0].classList.remove('selected');
	tabmenu.getElementsByClassName('comment-vote-history')[0].classList.add('selected');

	/* remove all comments */
	for (let i = site_table.children.length - 1; i > -1; i--) {
		site_table.removeChild(site_table.children[i]);
	}

	let saved_comments = get_all_comments();

	/* sort */
	saved_comments.sort(function (a, b) {
		if (sort_by == 'new') {
			return Date.parse(b.time) - Date.parse(a.time);
		}

		return Date.parse(a.time) - Date.parse(b.time);
	});

	for (let i = 0; i < saved_comments.length; i++) {
		append_comment(site_table, saved_comments[i]);
	}
}

function append_comment(where, comment) {
	let comment_div = document.createElement('div'),
		entry       = document.createElement('div'),
		date        = new Date(comment.time);

	/* create time tooltip string, similar to reddit's */
	let date_str = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()] + ' ' +
		['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()] + ' ' +
		date.getUTCDate() + ' ' + date.getUTCHours() + ':' + date.getUTCMinutes() + ':' + date.getUTCSeconds() + ' ' +
		date.getUTCFullYear() + ' UTC';

	/* markup for a comment */
	comment_div.innerHTML =
		'<div class="midcol">\n' +
		'	<div class="arrow up' + (comment.direction == 'up' ? 'mod' : '') + '"></div>\n' +
		'	<div class="arrow down' + (comment.direction == 'down' ? 'mod' : '') + '"></div>\n' +
		'</div>\n' +
		'<div class="entry">\n' +
		'	<p class="tagline">\n' +
		'		<a href="/user/' + comment.author + '" class="author">' + comment.author + '</a>\n' +
		'		<time datetime="' + comment.time +'" title="' + date_str + '">' + time_ago(comment.time) + '</time>\n' +
		'	</p>\n' +
		'	<div class="usertext usertext-body">\n' +
		'		<div class="md">\n' +
		'			' + comment.text + '\n' +
		'		</div>\n' +
		'	</div>\n' +
		'	<ul class="flat-list buttons">\n' +
		'		<li><a href="' + comment.link +'">permalink</a></li>\n' +
		'		<li><a href="' + comment.link +'?context=3">context</a></li>\n' +
		'		<li><a href="' + comment.link.substr(0, comment.link.lastIndexOf('/') + 1) +'">comments</a></li>\n' +
		'		<li><a href="#" class="remove" data-fullname="' + comment.id + '">remove</a></li>\n' +
		'	</ul>\n' +
		'</div>\n'
	;

	comment_div.getElementsByClassName('remove')[0].addEventListener('click', function () {
		remove_comment(this.dataset.fullname);
		this.textContent = 'removed';
	});

	comment_div.classList.add('thing', 'comment', 'id-' + comment.id);
	comment_div.style.setProperty('margin-bottom', '10px');

	where.appendChild(comment_div);
}

function get_comment(comment_id) {
	return JSON.parse(GM_getValue(comment_id));
}

function get_all_comments() {
	/* convert JSON strings to objects */
	return GM_listValues().map(function (comment_id) {
		return get_comment(comment_id);
	});
}

function save_comment(comment) {
	GM_setValue(comment.id, JSON.stringify(comment));
}

function remove_comment(comment_id) {
	GM_deleteValue(comment_id);
}

/* authored by TheBrain, at http://stackoverflow.com/a/12475270 */
function time_ago(time) {
	switch (typeof time) {
		case 'number': break;
		case 'string': time = +new Date(time); break;
		case 'object': if (time.constructor === Date) time = time.getTime(); break;
		default: time = +new Date();
	}

	let time_formats = [
		[         60,      'seconds',                   1], // 60
		[        120, '1 minute ago', '1 minute from now'], // 60*2
		[       3600,      'minutes',                  60], // 60*60, 60
		[       7200,   '1 hour ago',   '1 hour from now'], // 60*60*2
		[      86400,        'hours',                3600], // 60*60*24, 60*60
		[     172800,    '1 day ago',          'Tomorrow'], // 60*60*24*2
		[     604800,         'days',               86400], // 60*60*24*7, 60*60*24
		[    1209600,   '1 week ago',         'Next week'], // 60*60*24*7*4*2
		[    2419200,        'weeks',              604800], // 60*60*24*7*4, 60*60*24*7
		[    4838400,  '1 month ago',        'Next month'], // 60*60*24*7*4*2
		[   29030400,       'months',             2419200], // 60*60*24*7*4*12, 60*60*24*7*4
		[   58060800,   '1 year ago',         'Next year'], // 60*60*24*7*4*12*2
		[ 2903040000,        'years',            29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
	];
	let seconds = (+new Date() - time) / 1000;

	if (seconds < 2) {
		return 'just now';
	}

	let i = 0,
		format;

	while (format = time_formats[i++]) {
		if (seconds < format[0]) {
			if (typeof format[2] == 'string') {
				return format[1];
			}
			else {
				return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ago';
			}
		}
	}

	return time;
}
