/**
 * CVN Overlay
 * https://github.com/countervandalism/mw-gadget-cvnoverlay
 *
 * @license http://krinkle.mit-license.org/
 * @author Timo Tijhof, 2010–2015
 */
(function ($, mw) {
	'use strict';

	/**
	 * Configuration
	 */
	var
		msg,
		cvnApiUrl = '//cvn.wmflabs.org/api.php',
		intuitionLoadUrl = '//tools.wmflabs.org/intuition/load.php?env=mw',
		cvnLogo = '//upload.wikimedia.org/wikipedia/commons/c/c2/CVN_logo.svg',
		blacklistIcon = '//upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Nuvola_apps_important.svg/18px-Nuvola_apps_important.svg.png',
		fullpagename = false,
		userSpec = false,
		isUserSpec = false,
		userSpecDone = false,
		canonicalSpecialPageName = mw.config.get('wgCanonicalSpecialPageName');

	/**
	 * Tool Functions
	 */

	// Construct a URL to a page on the wiki
	function wikiLink(s, targetserver) {
		return (targetserver || '') + mw.util.getUrl(s);
	}

	function parseWikiLink(input) {
		var targetserver, parts, startSplit, linkContent, linkSplit, linkTarget, linkText;

		targetserver = ''; // relative to current;
		if (input.indexOf('Autoblacklist: ') === 0) {
			parts = input.split(' ');
			if (parts[parts.length - 2] === 'on' || parts[parts.length - 2] === 'at') {
				targetserver = '//' + parts[parts.length - 1] + '.org';
			}
		}

		startSplit = input.split('[[');
		$.each(startSplit, function (i, val) {

			linkContent = val.split(']]');

			if (linkContent[1] !== undefined) {

				linkSplit = linkContent[0].split('|');
				if (linkSplit[1]) {
					linkTarget = linkSplit[0];
					linkText = linkSplit[1];
				} else {
					linkTarget = linkSplit[0];
					linkText = linkSplit[0];
				}
				startSplit[i] = '<a href="' + wikiLink(linkTarget, targetserver) + '" title="' + linkTarget + '">' + linkText + '</a>' + linkContent[1];

			} else {
				if (i !== 0) {
					val = ']]' + val;
				}
				startSplit[i] = val;
			}
		});
		return startSplit.join('');
	}

	/**
	 * App Main Functions
	 * -------------------------------------------------
	 */

	function doUserSpecBox(data) {
		var html, comment, commentHtml, d;

		comment = data.comment;
		if (comment) {
			commentHtml = parseWikiLink(mw.html.escape(comment));
			if ($('<div>').html(commentHtml).text().length > 33) {
				commentHtml = '<span style="cursor: help;">' + parseWikiLink(mw.html.escape(comment.slice(0, 30))) + '<abbr>...</abbr>' + '</span>';
			}
		}

		if (data.type) {
			html = 'On <span class="cvn-overlay-list cvn-overlay-list-' + data.type + '">' + data.type + '</span>';
		} else {
			html = '<span class="cvn-overlay-list cvn-overlay-list-unlisted">Unlisted</span>';
		}

		if (data.adder) {
			html += ' added by <span style="white-space: nowrap;">' + mw.html.escape(data.adder) + '</span>';
		}

		if (data.expiry) {
			d = new Date();
			d.setTime(data.expiry * 1000);
			html += ' <abbr style="vertical-align: super; font-size: smaller; color: purple;" title="until ' + mw.html.escape(d.toUTCString()) + '">(expiry)</abbr>';
		}

		if (commentHtml) {
			html += ': <em title="' + mw.html.escape(comment) + '">' + commentHtml + '</em>';
		}

		$('.cvn-overlay-userbox').remove();
		$('#firstHeading').before(
			'<div class="toccolours cvn-overlay-userbox">' +
				'<a class="cvn-overlay-logo" title="Counter-Vandalism Network"></a>' +
				html +
				'</div>'
		);
	}

	function doOverlayUsers(users) {
		$.each(users, function (name, user) {
			var tooltip, d;
			if (user.type === 'blacklist') {
				tooltip = '';

				if (user.comment) {
					tooltip += msg('reason') + ': ' + user.comment + '. ';
				} else {
					tooltip += msg('reason-empty');
				}

				if (user.adder) {
					tooltip += msg('adder') + ': ' + user.adder + '. ';
				} else {
					tooltip += msg('adder') + ': ' + msg('adder-empty');
				}

				// Get expiry date
				if (user.expiry) {
					d = new Date();
					d.setTime(user.expiry * 1000);
					tooltip += msg('expiry') + ': ' + d.toUTCString();
				} else {
					tooltip += msg('expiry') + ': ' + msg('adder-empty');
				}

				// Spit it out
				$('.mw-userlink')
					.filter(function () {
						return $(this).text() === name;
					})
					.not('.cvn-overlay-list-blacklist')
					.addClass('cvn-overlay-list-blacklist')
					.prepend('<img src="' + blacklistIcon + '" alt="" title="' + mw.html.escape(tooltip) + '"/>')
					.attr('title', tooltip);
			}
			// If the current page is about one specific user,
			// and we have data about that user in 'userdata',
			// and we haven't done this already, trigger the UserSpecBox
			if (isUserSpec && name === userSpec && userSpecDone === false) {
				userSpecDone = true;
				doUserSpecBox(user);
			}
		});

		// If the current page is about one specific user,
		// and we haven't done this already, it means the user
		// is unlisted in the base. Trigger it now
		if (isUserSpec && userSpecDone === false) {
			doUserSpecBox(false);
		}
	}

	function doOverlayPage(page) {
		var text, $krContentSub;

		if (page.comment) {
			text = msg('reason') + ': ' + parseWikiLink(mw.html.escape(page.comment)) + '. ';
		} else {
			text = msg('reason-empty');
		}

		if (page.adder) {
			text += msg('adder') + ': ' + page.adder;
		} else {
			text += msg('adder') + ': ' + msg('adder-empty');
		}

		$krContentSub = $('#contentSub');
		if ($krContentSub.html() !== '' && $krContentSub.text() !== ' ') {
			$krContentSub.append(' &middot; ');
		}

		$krContentSub
			.find('.cvn-overlay-pagesub').remove()
				.end()
			.append('<span class="cvn-overlay-pagesub"><span class="cvn-overlay-logo" title="Counter-Vandalism Network"></span>' +
				mw.html.escape(msg('globalwatched')) +
				'. ' +
				mw.html.escape(text) +
				'</span>'
			);
	}

	function checkAPI(users) {
		$.ajax({
			url: cvnApiUrl,
			data: {
				users: users.join('|'),
				pages: fullpagename || ''
			},
			dataType: $.support.cors ? 'json' : 'jsonp',
			cache: true
		}).done(function (data) {
			if (data.users) {
				doOverlayUsers(data.users);
			}

			if (data.pages && data.pages[fullpagename]) {
				doOverlayPage(data.pages[fullpagename]);
			}
		});
	}

	function getIsUserSpec() {
		var val;
		if (mw.config.get('wgTitle').indexOf('/') === -1 && $.inArray(mw.config.get('wgNamespaceNumber'), [2, 3]) !== -1) {
			userSpec = mw.config.get('wgTitle');
			return true;
		}

		val = $('#bodyContent .mw-contributions-form input[name="target"]').val();
		if (canonicalSpecialPageName === 'Contributions' && !$.isEmpty(val)) {
			userSpec = val;
			return true;
		}

		val = $('#mw-log-user').val();
		if (canonicalSpecialPageName === 'Log' && !$.isEmpty(val)) {
			userSpec = val;
			return true;
		}

		val = $('#mw-bi-target').val();
		if (canonicalSpecialPageName === 'Blockip' && !$.isEmpty(val)) {
			userSpec = val;
			return true;
		}

		userSpecDone = true;
		return false;
	}

	function execute() {
		var usernamesOnPage = [];
		mw.util.addCSS('\
			.cvn-overlay-userbox {\
				margin: 0;\
				padding: 0 3px;\
				float: right;\
				font-size: 13px;\
				line-height: 1.4;\
				text-align: left;\
			}\
			.cvn-overlay-logo {\
				display: inline-block;\
				vertical-align: middle;\
				background: url(' + cvnLogo + ') no-repeat 0 50%;\
				background-size: 13px;\
				width: 13px;\
				height: 13px;\
				margin-right: 3px;\
			}\
			.cvn-overlay-list-blacklist,\
			.mw-userlink.cvn-overlay-list-blacklist { color: red; }\
			.mw-userlink.cvn-overlay-list-blacklist img { vertical-align: bottom; }\
			.cvn-overlay-list-whitelist { color: teal; }\
			.cvn-overlay-list-unknown,\
			.cvn-overlay-list-unlisted { color: grey; }'
		);

		$('.mw-userlink').each(function () {
			var username = $(this).text();
			if ($.inArray(username, usernamesOnPage) === -1) {
				usernamesOnPage.push(username);
			}
		});

		if (mw.config.get('wgNamespaceNumber') >= 0) {
			if (mw.config.get('wgNamespaceNumber') === 0) {
				fullpagename = '';
			} else {
				// We need fullpagename but unescaped (wgPageName is escaped like Main_Page)
				// wgTitle is unescaped but without namespace so we rebuild from namespace and wgTitle
				// if namespace is not main, then prefix namespace and colon. Otherwise no prefix.
				fullpagename = mw.config.get('wgCanonicalNamespace') + ':';
				if (fullpagename === 'File:') {
					// CVN uses Image: instead of File:
					fullpagename = 'Image:';
				}
			}
			fullpagename += mw.config.get('wgTitle');
		}

		// If the current page is about one specific user, add it to the array
		// This could cause it to be in the array twice, but the API takes filters out duplicates (array_unique) before querying.
		isUserSpec = getIsUserSpec();
		if (isUserSpec) {
			usernamesOnPage.push(userSpec);
		}

		// Only load if we have usernames and/or are on an editable/watchable/non-special page
		if (usernamesOnPage.length || fullpagename) {
			checkAPI(usernamesOnPage);
		}
	}

	function init() {
		if (!mw.libs.getIntuition) {
			mw.libs.getIntuition = $.ajax({ url: intuitionLoadUrl, dataType: 'script', cache: true });
		}

		var i18nLoad = mw.libs.getIntuition
			.then(function () {
				return mw.libs.intuition.load('cvnoverlay');
			})
			.done(function () {
				msg = $.proxy(mw.libs.intuition.msg, null, 'cvnoverlay');
			});

		$.when(mw.loader.using(['mediawiki.util', 'jquery.mwExtension']), i18nLoad, $.ready).done(execute);
	}

	// Dont load at all in edit mode unless the page doesn't exist yet (like a User-page)
	if (
		(mw.config.get('wgAction') !== 'edit' || mw.util.getParamValue('redlink') === '1') &&
			mw.config.get('wgAction') !== 'submit'
	) {
		init();
	}

}(jQuery, mediaWiki));
