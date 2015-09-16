// ==UserScript==
// @name        Bing Images Direct
// @namespace   https://github.com/Farow/userscripts
// @description Removes the preview and makes links direct
// @include     http*://www.bing.com/images/search*
// @include     http*://www.bing.com/videos/search*
// @version     1.0.2
// @grant       none
// ==/UserScript==

/*
	changelog:
		2015-08-27 - 1.0.2 - fixed issue when changing image size
		2015-08-06 - 1.0.1 - added support for videos
		2015-04-20 - 1.0.0 - initial release
*/

var observer = new MutationObserver(image_observer);
init();

function init() {
	var wrapper = document.getElementById('dg_c');

	if (!wrapper) {
		/* we could be inside an iframe, check parent */
		wrapper = window.parent._d.getElementById('dg_c');

		/* failure */
		if (!wrapper) {
			return;
		}
	}

	var images = wrapper.getElementsByClassName('dg_u');

	for (var i = 0; i < images.length; i++) {
		make_direct(images[i].children[0]);
	}

	observer.observe(wrapper, { childList: true });
}

function make_direct(image) {
	var url;

	/* for images */
	if (image.hasAttribute('m')) {
		url = image.getAttribute('m').match(/imgurl:"([^"]+?)",/)[1];
	}
	/* for videos */
	else {
		url = image.getAttribute('vrhm').match(/"p":"([^"]+?)"/)[1];
	}

	image.outerHTML = '<a href="' + url + '">' + image.innerHTML + '</a>';
}

function image_observer(mutations) {
	mutations.forEach(function(mutation) {
		for (var i = 0; i < mutation.addedNodes.length; i++) {
			var images = mutation.addedNodes[i].getElementsByClassName('dg_u');

			for (var k = 0; k < images.length; k++) {
				make_direct(images[k].children[0]);
			}
		}
	});
}
