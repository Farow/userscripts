// ==UserScript==
// @name        Copy hovered link
// @namespace   https://github.com/Farow/userscripts
// @description Ctrl+C copies the text, Shift+C copies the url.
// @include     *
// @version     1.0.0
// @grant       GM_setClipboard
// ==/UserScript==

document.addEventListener('keydown', e => {
	if (e.code != 'KeyC' || e.altKey || e.metaKey || (e.ctrlKey && e.shiftKey)) {
		return;
	}

	if (window.getSelection().type == 'Range') {
		return;
	}

	const a = document.querySelector('a:hover');

	if (!a) {
		return;
	}

	if (e.ctrlKey) {
		GM_setClipboard(a.textContent);
	}
	else if (e.shiftKey) {
		GM_setClipboard(a.href);
	}

	e.preventDefault();
	e.stopPropagation();
});
