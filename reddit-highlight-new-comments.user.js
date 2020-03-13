// ==UserScript==
// @name        Reddit highlight new comments
// @namespace   https://github.com/Farow/userscripts
// @description Highlights new comments since your last visit
// @include     /https?:\/\/[a-z]+\.reddit\.com\/r\/[\w:+-]+\/comments\/[\da-z]/
// @version     2.0.2
// @require     https://raw.githubusercontent.com/bgrins/TinyColor/master/tinycolor.js
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_addStyle
// ==/UserScript==

'use strict';

/*
	changelog:

		2020-03-14 - 2.0.2 - fixed exception on comments with no live timestamps
		2019-02-12 - 2.0.1 - fixed issue with media threads
		2016-02-16 - 2.0.0
			- removed better/worse comments
			- removed option to use reddit's new comment highlighting, it is now removed
			- added support for Chromium
			- all visits within the past 7 days are show in a dropdown (similar to reddit's highlighting),
			  you can still choose a custom time
			- added UI for settings with a preview, settings won't be reset on every update
			- you can now select which part of the comment is highlighted
			  available options: whole comment, text and time
		2015-02-20 - 1.0.2 - added option to use either this script's or reddit's comment highlighting
		2014-09-10 - 1.0.1 - no longer highlights your own comments
		2014-08-31 - 1.0.0 - initial release
*/

let HNC = {
	init: function () {
		if (!document.getElementById('siteTable')) {
			return;
		}

		let thread = document.getElementsByClassName('thing link')[0].className.match(/id-(t3_[^ ]+)/)[1],
			now    = Date.now()
		;

		this.config = this.cfg.load();
		this.clear_history();

		if (!this.config.history[thread]) {
			this.config.history[thread] = [ ];
		}

		this.config.history[thread].unshift(now);

		/* check for comments */
		if (!document.getElementById('noresults')) {
			/* highlight */
			if (this.config.history[thread].length > 1) {
				this.highlight(this.config.history[thread][1]);
			}

			/* add UI */
			this.ui.create_comment_highlighter(this.config.history[thread]);
			this.ui.create_config_dialog();
			GM_addStyle(this.data.get('config_style'));
		}

		this.cfg.save();
	},

	highlight: function (since) {
		let comments = document.getElementsByClassName('comment'),
			username
		;

		if (document.body.classList.contains('loggedin')) {
			username = document.getElementsByClassName('user')[0].firstElementChild.textContent;
		}

		for (let comment of comments) {
			/* skip removed or deleted comments */
			if (comment.classList.contains('deleted') || comment.classList.contains('spam')) {
				continue;
			}

			/* skip our own comments */
			let author = comment.getElementsByClassName('author')[0].textContent;
			if (username && username == author) {
				continue;
			}

			/* select original or edited comment time */
			let times = comment.getElementsByClassName('tagline')[0].getElementsByTagName('time'),
				time  = Date.parse(times[this.config.prefer_edited_time ? times.length - 1 : 0].getAttribute('datetime'))
			;

			/* add styles */
			if (time > since) {
				comment.classList.add('hnc_new');

				let elements = {
					'comment': comment,
					'text': comment.getElementsByClassName('usertext-body')[0].firstElementChild,
					'time': comment.getElementsByClassName('live-timestamp')[0],
				};

				elements[this.config.apply_on].setAttribute('style', this.generate_comment_style(time, since));
			}
		}
	},

	reset_highlighting: function () {
		let comments = document.getElementsByClassName('hnc_new');

		for (let i = comments.length; i > 0; i--) {
			let comment = comments[i - 1];
			comment.classList.remove('hnc_new');

			let elements = {
				'comment': comment,
				'text': comment.getElementsByClassName('usertext-body')[0].firstElementChild,
				'time': comment.getElementsByTagName('time')[0],
			};

			for (let element in elements) {
				elements[element].removeAttribute('style');
			}
		}
	},

	clear_history: function () {
		let now        = Date.now();
		let expiration = this.config.history_expiration * 24 * 60 * 60 * 1000;

		for (let thread in this.config.history) {
			let visits = this.config.history[thread];

			for (let i = 0; i < visits.length; i++) {
				if (now - visits[i] > expiration) {
					this.config.history[thread].splice(i);

					if (!this.config.history[thread].length) {
						delete this.config.history[thread];
					}
				}
			}
		}
	},

	generate_comment_style: function (comment_time, since) {
		let style = this.config.comment_style;

		style = style.replace(/\s+/g, ' ');
		style = style.replace(/%color/g, this.get_color(Date.now() - comment_time, Date.now() - since));

		return style;
	},

	get_color: function (comment_age, highlighting_since) {
		if (!this.config.use_color_gradient) {
			return this.config.color_newer;
		}

		if (comment_age > highlighting_since - 1) {
			return this.config.color_older;
		}

		let time_diff = 1 - comment_age / highlighting_since,
			color_newer   = tinycolor(this.config.color_newer).toHsl(),
			color_older   = tinycolor(this.config.color_older).toHsl()
		;

		let color_final = tinycolor({
			h: color_older.h + (color_newer.h - color_older.h) * time_diff,
			s: color_older.s + (color_newer.s - color_older.s) * time_diff,
			l: color_older.l + (color_newer.l - color_older.l) * time_diff,
		});

		return color_final.toHslString();
	},
};

HNC.ui = {
	create_comment_highlighter: function (visits) {
		/* create element */
		let highlighter = document.createElement('div');

		highlighter.innerHTML = HNC.data.get('comment_highlighter');
		highlighter.classList.add('rounded', 'gold-accent', 'comment-visits-box');

		let commentarea      = document.getElementsByClassName('commentarea')[0],
			sitetable        = commentarea.getElementsByClassName('sitetable')[0],
			comment_margin   = window.getComputedStyle(sitetable.firstChild).getPropertyValue('margin-left'),
			gold_highlighter = document.getElementsByClassName('comment-visits-box')[0]
		;

		/* remove default comment highlighter */
		if (gold_highlighter) {
			gold_highlighter.parentNode.removeChild(gold_highlighter);
		}

		/* properly place */
		highlighter.style.setProperty('margin-left', comment_margin);
		commentarea.insertBefore(highlighter, sitetable);

		/* generate visits */
		let select = document.getElementById('comment-visits');

		for (let visit of visits) {
			let option = document.createElement('option');
			option.textContent = time_ago(visit);
			option.value = visit;
			select.appendChild(option);
		}

		if (visits.length > 1) {
			select.children[3].setAttribute('selected', '');
		}


		/* add listeners */
		select.addEventListener('change', this.update_highlighting);

		let custom = document.getElementById('hnc_custom_visit');
		custom.style.setProperty('width', (select.getBoundingClientRect().width) + 'px');
		custom.addEventListener('keydown', this.custom_visit_key_monitor);
		custom.addEventListener('blur', this.set_custom_visit);

		this.custom_pos = 0;

		/* config button */
		let config_button = document.getElementById('hnc_config_icon');

		config_button.style.setProperty('background-image', HNC.data.get('config_icon').replace(/\s/g, ''));
		config_button.addEventListener('click', this.show_config_dialog);
	},

	update_highlighting: function (event) {
		/* no highlighting */
		if (event.target.value == '') {
			HNC.reset_highlighting();
		}

		/* custom */
		else if (event.target.value == 'custom') {
			document.getElementById('comment-visits').style.setProperty('display', 'none');
			let custom = document.getElementById('hnc_custom_visit');
			custom.style.removeProperty('display');
			custom.focus();
			custom.setSelectionRange(0, 2);
		}

		/* previous visit */
		else {
			HNC.reset_highlighting();
			HNC.highlight(parseInt(event.target.value, 10));
		}
	},

	custom_visit_key_monitor: function (event) {
		if (event.altKey || event.ctrlKey || (event.shiftKey && event.key != 'Tab')) {
			return;
		}

		if (event.key == 'Tab') {
			let match = event.target.value.match(/^(\d+?:)\d+?$/);

			if (match) {
				if (event.shiftKey) {
					HNC.ui.custom_pos--;
				}
				else {
					HNC.ui.custom_pos++;
				}

				if (HNC.ui.custom_pos % 2 == 0) {
					event.target.setSelectionRange(0, match[1].length - 1);
				}
				else {
					event.target.setSelectionRange(match[1].length, match[0].length);
				}

				event.preventDefault();
				event.stopPropagation();
			}
		}
		else if (event.key == 'Enter') {
			event.target.blur();
			event.preventDefault();
			event.stopPropagation();
		}
	},

	set_custom_visit: function (event) {
		let select = document.getElementById('comment-visits'),
			match  = event.target.value.match(/^(\d+?):(\d+?)$/)
		;

		if (match) {
			let option  = document.createElement('option'),
				hours   = parseInt(match[1], 10),
				minutes = parseInt(match[2], 10),
				visit   = Date.now() - (hours * 60 + minutes) * 60 * 1000
			;

			option.value = visit;
			option.textContent = time_ago(visit);

			select.add(option, 2);
			select.selectedIndex = 2;
		}
		else {
			select.selectedIndex = 0;
		}

		let change = new Event('change');
		select.dispatchEvent(change);

		event.target.value = '00:00';
		event.target.style.setProperty('display', 'none');
		select.style.removeProperty('display');
	},

	create_config_dialog: function () {
		/* create wrapper */
		let wrapper = document.createElement('div');
		document.body.appendChild(wrapper);
		wrapper.id = 'hnc_dialog_wrapper';
		wrapper.innerHTML = HNC.data.get('config_dialog');

		/* add preview */
		let comment_preview = document.getElementById('hnc_comment_preview');
		let first_comment = document.getElementsByClassName('comment')[0].cloneNode(true);
		first_comment.removeChild(first_comment.getElementsByClassName('child')[0]);
		first_comment.style.setProperty('margin-left', '0');
		comment_preview.appendChild(first_comment);

		wrapper.style.setProperty('display', 'none');
		wrapper.addEventListener('click', this.hide_config_dialog);

		this.load_config_values();
		this.add_listeners();
	},

	show_config_dialog: function () {
		document.getElementById('hnc_dialog_wrapper').style.removeProperty('display');

		/* disable scrolling */
		//document.body.style.setProperty('top', -document.documentElement.scrollTop + 'px');
		//document.body.style.setProperty('position', 'fixed');
		//document.body.style.setProperty('overflow-y', 'scroll');
		//document.body.style.setProperty('width', '100%');
	},

	hide_config_dialog: function (event) {
		if (event.target.id != 'hnc_dialog_wrapper' && event.target.id != 'hnc_close_button') {
			return;
		}

		let wrapper = document.getElementById('hnc_dialog_wrapper');
		wrapper.style.setProperty('display', 'none');

		/* enable scrolling */
		//let scroll = -parseInt(document.body.style.top, 10);
		//document.body.style.removeProperty('overflow-y');
		//document.body.style.removeProperty('position');
		//document.documentElement.scrollTop = scroll;

		HNC.reset_highlighting();
		HNC.highlight(parseInt(document.getElementById('comment-visits').value, 10));
		HNC.cfg.save();
	},

	load_config_values: function () {
		let dialog_settings = document.getElementsByClassName('hnc_setting');

		for (let element of dialog_settings) {
			let name = element.id.slice(4);

			if (element.tagName == 'INPUT' && element.type == 'checkbox') {
				element.checked = HNC.config[name];
				if (element.dataset.disable) {
					document.getElementById(element.dataset.disable).disabled = !element.checked;
				}
			}
			else {
				element.value = HNC.config[name];
			}
		}

		this.update_preview();
	},

	add_listeners: function () {
		let dialog_settings = document.getElementsByClassName('hnc_setting');

		for (let element of dialog_settings) {
			element.addEventListener('change', this.setting_change);
		}

		document.getElementById('hnc_clear_history_button').addEventListener('click', this.clear_all_history);
		document.getElementById('hnc_reset_button').addEventListener('click', this.reset_config);
		document.getElementById('hnc_close_button').addEventListener('click', this.hide_config_dialog);
	},

	setting_change: function (event) {
		let name = event.target.id.slice(4);

		if (event.target.tagName == 'INPUT' && event.target.type == 'text' && !event.target.validity.valid) {
			event.target.value = HNC.config[name];
			return;
		}

		if (event.target.tagName == 'INPUT' && event.target.type == 'checkbox') {
			HNC.config[name] = event.target.checked;
			if (event.target.dataset.disable) {
				document.getElementById(event.target.dataset.disable).disabled = !event.target.checked;
			}
		}
		else {
			HNC.config[name] = event.target.value;
		}

		HNC.ui.update_preview();
	},

	reset_config: function (event) {
		/* keep history */
		let history = HNC.config.history;

		/* reset */
		HNC.config = HNC.cfg.default();
		HNC.config.history = history;

		HNC.ui.load_config_values();
	},

	clear_all_history: function (event) {
		HNC.config.history = { };
	},

	update_preview: function () {
		let preview = document.getElementById('hnc_comment_preview').firstElementChild;

		let elements = {
			'comment': preview,
			'text': preview.getElementsByClassName('usertext-body')[0].firstElementChild,
			'time': preview.getElementsByClassName('live-timestamp')[0],
		};

		for (let element in elements) {
			elements[element].removeAttribute('style');
		}

		let comment_age        = Date.parse(elements.time.getAttribute('dateTime')),
			double_comment_age = comment_age - (Date.now() - comment_age) * 2
		;

		elements[HNC.config.apply_on].setAttribute('style', HNC.generate_comment_style(comment_age, double_comment_age));
	},
};

HNC.data = {
	comment_highlighter: function () {/*
		<div class="title" style="line-height: 20px;">Highlight comments since:
			<select id="comment-visits">
				<option value="">no highlighting</option>
				<option value="custom">custom</option>
			</select>
			<input id="hnc_custom_visit" type="text" value="00:00" pattern="\d+?:\d+?" style="display: none;" />
			<span id="hnc_config_icon"></span>
		</div>
	*/},

	config_dialog: function () {/*
		<div id="hnc_dialog">
			<div>
				<label><input id="hnc_prefer_edited_time" class="hnc_setting" type="checkbox">Highlight edited comments</label>
			</div>

			<hr />

			<div>
				<label><input type="checkbox" id="hnc_use_color_gradient" class="hnc_setting" data-disable="hnc_color_older">Use time based color gradient</label>
			</div>
			<div>
				<label class="hnc_fixed_width" for="hnc_color_newer">Newer comments color</label><input type="text" id="hnc_color_newer" class="hnc_setting" title="Supported formats:&#13;#80bfff&#13;rgba(128, 191, 255, 1)&#13;hsla(210, 100%, 75%, 1)" pattern="(#(?:[\da-fA-F]{3}){1,2}|rgb\((?:\d{1,3},\s*){2}\d{1,3}\)|rgba\((?:\d{1,3},\s*){3}\d*\.?\d+\)|hsl\(\d{1,3}(?:,\s*\d{1,3}%){2}\)|hsla\(\d{1,3}(?:,\s*\d{1,3}%){2},\s*\d*\.?\d+\))">
			</div>
			<div>
				<label class="hnc_fixed_width" for="hnc_color_older">Older comments color</label><input type="text" id="hnc_color_older" class="hnc_setting" title="Supported formats:&#13;#cce5ff&#13;rgba(204, 229, 255, 1)&#13;hsla(210, 100%, 90%, 1)" pattern="(#(?:[\da-fA-F]{3}){1,2}|rgb\((?:\d{1,3},\s*){2}\d{1,3}\)|rgba\((?:\d{1,3},\s*){3}\d*\.?\d+\)|hsl\(\d{1,3}(?:,\s*\d{1,3}%){2}\)|hsla\(\d{1,3}(?:,\s*\d{1,3}%){2},\s*\d*\.?\d+\))">
			</div>

			<hr />

			<div>
				<label class="hnc_fixed_width" for="hnc_apply_on">Apply styles on</label><select id="hnc_apply_on" class="hnc_setting"><option>text</option><option>comment</option><option>time</option></select>
			</div>
			<div>
				<label for="hnc_comment_style">Comment style</label>
				<textarea id="hnc_comment_style" class="hnc_setting"></textarea>
			</div>

			<hr />

			<div>
				<label for="hnc_comment_preview">Preview</label>
				<div id="hnc_comment_preview"></div>
			</div>

			<hr />

			<div style="float: right">
				<button id="hnc_clear_history_button">Clear history</button>
				<button id="hnc_reset_button">Reset</button>
				<button id="hnc_close_button">Close</button>
			<div>
		</div>
	*/},

	config_style: function () {/*
		input.hnc_setting[pattern]:invalid, #hnc_custom_visit:invalid {
			box-shadow: 0 0 5px 0 #FF4060;
			background-color: #FF4060;
		}

		#hnc_config_icon {
			display: inline-block;
			width: 20px;
			height: 20px;
			vertical-align: top;
		}

		#hnc_dialog_wrapper {
			display: flex;
			justify-content: center;
			align-items: center;
			position: fixed;
			top: 0;
			width: 100%;
			height: 100%;
			z-index: 2147483647;
			background-color: rgba(192, 192, 192, 0.7);
			font-size: 12px;
		}

		#hnc_dialog {
			align-self: flex-start;
			margin-top: 80px;
			padding: 5px 0;
			width: 900px;
			max-height: 95%;
			overflow-y: auto;
			box-shadow: 0 0 20px 5px rgb(64, 64, 64);
			background-color: #F5F5F5;
		}

		#hnc_dialog > div {
			margin: 5px 10px;
		}

		#hnc_dialog > hr {
			margin: 0;
			height: 1px;
			border: none;
			background-color: grey;
		}

		label.hnc_fixed_width {
			width: 148px;
		}

		#hnc_dialog label {
			display: inline-block;
		}

		#hnc_dialog label > input:not([type=checkbox]) {
			margin-left: 5px;
		}

		#hnc_dialog label > input[type=checkbox] {
			margin-right: 5px;
			vertical-align: top;
		}

		#hnc_comment_style {
			box-sizing: border-box;
			width: 100% !important;
			height: 50px;
			max-height: 400px;
			font-family: monospace;
		}
	*/},

	config_icon: function () {/*
		url(data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAACxIAAAsSAdLdfvwA
		AAAYdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjAuNvyMY98AAAIfSURBVDhPnZQ9SBxRFIXHaIgg2Agm2GhhofiDsCAYiwV1ZQnM/rIGUmStFtLY
		hkjCdoKKtU1S2PmDyGLAThAEC8HKQhsFFSwFE0yCuua7b+9bXtbZoB44zLxzzr3z3ps34/0P+Xz+WSKRKMAbYTKZXFXraYjH48M0KcI7ZTGVSg2q
		/XAwmyY4C/84zSx/on+ORCINGg8GoQEYomACXjgNqvGEFbzj2k1dv7YpAWEMw12aIfoVLHA/BWe43+R6bX2HshVvTbNoNPqC4GlAaD2TybwyIQfp
		dLqL/F5lHu1MeplAgFmgWa32uAcKG8nsV9Yxyw7xaxgsWZHgD67NphLIU9krH74Jh8N1KssJeE2uvE3ULSDXGJPBB2vAZSOCUCj0HG/bKdpALhWV
		JnLoeCnVTcNP1oBfVBY97OiGzKxPbfEXHe+9yp7HYNIahPIqS4Eco3IzWPR9v11tqVu2HtmsysaQs2eNgsoCWdY8LKLfwmnVzWeJfmzrysdG3ibB
		79aAvzBbjamIxWItzOylDg2oGXVqZCIr5mSwJz2uoeZWNput19p7kPNJrjw7p67Ty+Vy8iaPAswdeZj2sJAtGArKwyPpZVIs0Sckv6d/Qmi3XHfh
		N+4XuB5Yz6XWxkwzC76YXoxOjI/w0oarkew5ExlnFW2Mu7VNMGSPKPhKMOhH8BvOyeen8YeDp/sVzeSvMqL246FnbV32SPdpTa0q8Ly/60amOe0Z
		Tw0AAAAASUVORK5CYII=)
	*/},

	get: function (name) {
		return this.function_to_string(this[name]);
	},

	/* original authored by lavoiesl, at https://gist.github.com/lavoiesl/5880516*/
	function_to_string: function (func, strip_leading_whitespace) {
		if (strip_leading_whitespace === undefined) {
			strip_leading_whitespace = 1;
		}

		let matches = func.toString().match(/function[\s\w]*?\(\)\s*?\{[\S\s]*?\/\*\!?\s*?\n([\s\S]+?)\s*?\*\/\s*\}/);

		if (!matches) {
			return false;
		}

		if (strip_leading_whitespace) {
			matches[1] = matches[1].replace(/^(\t| {4})/gm, '');
		}

		return matches[1];
	}
};

HNC.cfg = {
	load: function () {
		let config = GM_getValue('config');

		if (!config) {
			return this.default();
		}

		return JSON.parse(config);
	},

	save: function () {
		GM_setValue('config', JSON.stringify(HNC.config));
	},

	default: function () {
		return {
			'prefer_edited_time': 1,
			'use_color_gradient': 1,
			'color_newer': 'hsl(210, 100%, 65%)',
			'color_older': 'hsl(210, 100%, 90%)',
			'apply_on': 'text',
			'comment_style': 'background-color: %color !important;\npadding: 0 5px;',

			'history': { },
			'history_expiration': 7, /* in days */
		};
	},
}

/* original authored by TheBrain, at http://stackoverflow.com/a/12475270 */
function time_ago(time, precision) {
	if (precision == undefined) {
		precision = 2;
	}

	switch (typeof time) {
		case 'number': break;
		case 'string': time = +new Date(time); break;
		case 'object': if (time.constructor === Date) time = time.getTime(); break;
		default: time = +new Date();
	}

	let time_formats = [
		[         60,  'seconds',                   1], // 60
		[        120, '1 minute', '1 minute from now'], // 60*2
		[       3600,  'minutes',                  60], // 60*60,               60
		[       7200,   '1 hour',   '1 hour from now'], // 60*60*2
		[      86400,    'hours',                3600], // 60*60*24,            60*60
		[     172800,    '1 day',          'Tomorrow'], // 60*60*24*2
		[     604800,     'days',               86400], // 60*60*24*7,          60*60*24
		[    1209600,   '1 week',         'Next week'], // 60*60*24*7*4*2
		[    2419200,    'weeks',              604800], // 60*60*24*7*4,        60*60*24*7
		[    4838400,  '1 month',        'Next month'], // 60*60*24*7*4*2
		[   29030400,   'months',             2419200], // 60*60*24*7*4*12,     60*60*24*7*4
		[   58060800,   '1 year',         'Next year'], // 60*60*24*7*4*12*2
		[ 2903040000,    'years',            29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
	];
	let seconds = (+new Date() - time) / 1000;

	if (seconds < 2) {
		return 'just now';
	}

	let durations = [ ];

	while (1) {
		let i = 0,
			format;

		while (format = time_formats[i++]) {
			if (seconds < format[0]) {
				if (typeof format[2] == 'string') {
					durations.push(format[1]);
					break;
				}
				else {
					durations.push(Math.floor(seconds / format[2]) + ' ' + format[1]);
					break;
				}
			}
		}

		if (i > time_formats.length) {
			return 'a very long time ago';
		}

		if (typeof time_formats[i - 1][2] == 'string') {
			seconds -= time_formats[i][2];
		}
		else {
			seconds -= Math.floor(seconds / time_formats[i - 1][2]) * time_formats[i - 1][2];
		}

		if (precision > i && durations.length > 1) {
			durations.pop();
			break;
		}

		if (seconds == 0) {
			break;
		}
	}

	let result;

	result = durations.slice(-2).join(' and ') + ' ago';
	durations  = durations.slice(0, -2);

	if (durations.length) {
		durations.push(result);
		result = durations.join(', ');
	}

	return result;
}

try {
	HNC.init();
}
catch (error) {
	console.log(error);
}
