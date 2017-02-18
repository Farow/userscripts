// ==UserScript==
// @name        Bing Images Direct
// @namespace   https://github.com/Farow/userscripts
// @description Removes the preview and makes links direct
// @include     http*://www.bing.com/images/search*
// @version     1.0.5
// @grant       none
// ==/UserScript==

/*
	changelog:
		2017-02-18 - 1.0.5
			- fixed issues caused by site changes
			- no longer working on videos
			- doesn't work on all images loaded dynamically
		2016-09-16 - 1.0.4 - fixed issue caused by site changes
		2016-02-19 - 1.0.3 - prevent sending referrer headers
		2015-08-27 - 1.0.2 - fixed issue when changing image size
		2015-08-06 - 1.0.1 - added support for videos
		2015-04-20 - 1.0.0 - initial release
*/

var observer = new MutationObserver(image_observer);
init();

function init() {
	var wrapper = document.getElementById('mmComponent_images_1');

	if (!wrapper) {
		/* we could be inside an iframe, check parent */
		wrapper = window.parent._d.getElementById('mmComponent_images_1');

		/* failure */
		if (!wrapper) {
			return;
		}
	}

	var images = wrapper.getElementsByClassName('iusc');

	for (var i = 0; i < images.length; i++) {
		make_direct(images[i]);
	}

	observer.observe(wrapper, { childList: true });
}

function make_direct(image) {
	image.href = image.getAttribute('m').match(/"murl":"([^"]+?)"/)[1];
}

function image_observer(mutations) {
	mutations.forEach(function(mutation) {
		for (var i = 0; i < mutation.addedNodes.length; i++) {
			var images = mutation.addedNodes[i].getElementsByClassName('iusc');

			for (var k = 0; k < images.length; k++) {
				make_direct(images[k]);
			}
		}
	});
}
