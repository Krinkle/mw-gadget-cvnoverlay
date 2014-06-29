/**
 * CVN SimpleOverlay for Wiki
 * https://meta.wikimedia.org/wiki/User:Krinkle/Scripts/CVNSimpleOverlay
 *
 * @revision 2014-05-07
 *
 * @license http://krinkle.mit-license.org/
 * @author Timo Tijhof, 2010–2014
 * @track [[File:Krinkle_CVNSimpleOverlay_wiki.js]]
 */
/*jshint browser:true, undef:true, unused:true, multistr:true, white:true */
/*global jQuery, mediaWiki, alert */
(function ($, mw) {
	'use strict';

	/**
	 * Configuration
	 */
	var
		cvnApi = '//cvn.wmflabs.org/api.php',
		supportSVG = document.createElementNS && document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect,
		cvnLogo = supportSVG ?
			'//upload.wikimedia.org/wikipedia/commons/c/c2/CVN_logo.svg' :
			'//upload.wikimedia.org/wikipedia/commons/thumb/c/c2/CVN_logo.svg/13px-CVN_logo.svg.png',
		cvnLastUpdate = '',
		blacklistIcon = '//upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Nuvola_apps_important.svg/18px-Nuvola_apps_important.svg.png',
		fullpagename = false,
		userSpec = false,
		isUserSpec = false,
		userSpecDone = false,
		canonicalSpecialPageName = mw.config.get('wgCanonicalSpecialPageName');

	/**
	 * Tool Functions
	 */

	// Get interface message
	function msg(key) {
		return window.krMsgs[key] || $.ucFirst(key);
	}

	// Construct a URL to a page on the wiki
	function wikiLink(s, targetserver) {
		return (targetserver || '') + mw.util.wikiGetlink(s);
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

	function cvnSO_doUserSpecBox(data) {
		var html, comment, commentHtml, d;

		comment = data.comment;
		if (comment) {
			commentHtml = parseWikiLink(mw.html.escape(comment));
			if ($('<div>').html(commentHtml).text().length > 33) {
				commentHtml = '<span style="cursor: help;">' + parseWikiLink(mw.html.escape(comment.slice(0, 30))) + '<abbr>...</abbr>' + '</span>';
			}
		}

		if (data.type) {
			html = 'On <span class="cvn-so-list cvn-so-list-' + data.type + '">' + data.type + '</span>';
		} else {
			html = '<span class="cvn-so-list cvn-so-list-unlisted">Unlisted</span>';
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

		$('#cvnSO_UserSpecBox, .firstHeading .cvn-so-userbox').remove();
		$('#firstHeading').before(
			'<div class="toccolours cvn-so-userbox">' +
				'<a class="cvn-so-logo" title="Counter-Vandalism Network"></a>' +
				html +
				'</div>'
		);
	}

	function cvnSO_doOverlayUsers(users) {
		$.each(users, function (name, user) {
			var tooltip, d;
			if (user.type === 'blacklist') {
				tooltip = '';

				if (user.comment) {
					tooltip += msg('reason') + ': ' + user.comment + '. ';
				} else {
					tooltip += msg('noreasonfound');
				}

				if (user.adder) {
					tooltip += msg('adder') + ': ' + user.adder + '. ';
				} else {
					tooltip += msg('adder') + ': ' + msg('unknown');
				}

				// Get expiry date
				if (user.expiry) {
					d = new Date();
					d.setTime(user.expiry * 1000);
					tooltip += msg('expiry') + ': ' + d.toUTCString();
				} else {
					tooltip += msg('expiry') + ': ' + msg('unknown');
				}

				// Spit it out
				$('.mw-userlink')
					.filter(function () {
						return $(this).text() === name;
					})
					.not('.cvn-so-list-blacklist')
					.addClass('cvn-so-list-blacklist')
					.prepend('<img src="' + blacklistIcon + '" alt="" title="' + mw.html.escape(tooltip) + '"/>')
					.attr('title', tooltip);
			}
			// If the current page is about one specific user,
			// and we have data about that user in 'userdata',
			// and we haven't done this already, trigger the UserSpecBox
			if (isUserSpec && name === userSpec && userSpecDone === false) {
				userSpecDone = true;
				cvnSO_doUserSpecBox(user);
			}
		});

		// If the current page is about one specific user,
		// and we haven't done this already, it means the user
		// is unlisted in the base. Trigger it now
		if (isUserSpec && userSpecDone === false) {
			cvnSO_doUserSpecBox(false);
		}
	}

	function cvnSO_doOverlayPage(page) {
		var text, $krContentSub;

		if (page.comment) {
			text = msg('reason') + ': ' + parseWikiLink(mw.html.escape(page.comment)) + '. ';
		} else {
			text = msg('noreasonfound');
		}

		if (page.adder) {
			text += msg('adder') + ': ' + page.adder;
		} else {
			text += msg('adder') + ': ' + msg('unknown');
		}

		$krContentSub = $('#contentSub');
		if ($krContentSub.html() !== '' && $krContentSub.text() !== ' ') {
			$krContentSub.append(' &middot; ');
		}

		$krContentSub
		.find('.cvn-so-pagesub').remove().end()
		.append('<span class="cvn-so-pagesub"><span class="cvn-so-logo" title="Counter-Vandalism Network"></span>' +
			msg('globalwatched') +
			'. ' +
			text +
			'</span>'
		);
	}

	function cvnSO_checkAPI(users) {
		$.ajax({
			url: cvnApi,
			data: {
				users: users.join('|'),
				pages: fullpagename || ''
			},
			dataType: 'jsonp',
			cache: true
		}).done(function (data) {
			var d;

			if (data.users) {
				cvnSO_doOverlayUsers(data.users);
			}

			if (data.pages && data.pages[fullpagename]) {
				cvnSO_doOverlayPage(data.pages[fullpagename]);
			}

			if (data.lastUpdate) {
				d = new Date();
				d.setTime(data.lastUpdate * 1000);
				cvnLastUpdate = 'DB ' + msg('lastupdate') + ': ' + d.toUTCString();
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

	function init() {
		var usernamesOnPage = [],
			$pt = $('<li id="pt-cvnso" class="pt-cvnso" title="CVN Database information"><a href="//meta.wikimedia.org/wiki/CVN" title="m:CVN">CVN</a></li>');
		mw.util.addCSS('\
			.pt-cvnso {\
				background: url(' + cvnLogo + ') no-repeat 0 0;\
				background-size: 13px;\
				padding-left: 15px;\
			}\
			.pt-cvnso:hover { cursor: pointer; }\
			.cvn-so-userbox {\
				margin: 0;\
				padding: 0 3px;\
				float: right;\
				font-size: 13px;\
				line-height: 1.4;\
				text-align: left;\
			}\
			.cvn-so-logo {\
				display: inline-block;\
				vertical-align: middle;\
				background: url(' + cvnLogo + ') no-repeat 0 50%;\
				background-size: 13px;\
				width: 13px;\
				height: 13px;\
				margin-right: 3px;\
			}\
			.cvn-so-list-blacklist,\
			.mw-userlink.cvn-so-list-blacklist { color: red; }\
			.mw-userlink.cvn-so-list-blacklist img { vertical-align: bottom; }\
			.cvn-so-list-whitelist { color: teal; }\
			.cvn-so-list-unknown,\
			.cvn-so-list-unlisted { color: grey; }'
		);

		$('#p-personal')
			.find('.pt-cvnso').remove().end()
			.find('ul').eq(0).prepend($pt[0]);

		$pt
		.on('click', function () {
			alert('CVN SimpleOverlay\n\n' + cvnLastUpdate);
		})
		.find('a').on('click', function (e) {
			e.stopPropagation();
		});

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
			cvnSO_checkAPI(usernamesOnPage);
		}
	}

	/**
	 * Fire it off when the DOM is ready...
	 */
	// Dont load at all in edit mode unless the page doesn't exist yet (like a User-page)
	mw.loader.using(['mediawiki.util', 'jquery.mwExtension'], function () {

		if (
			(mw.config.get('wgAction') !== 'edit' || (mw.config.get('wgAction') === 'edit' && mw.util.getParamValue('redlink') === '1')) &&
				mw.config.get('wgAction') !== 'submit'
		) {
			$(document).ready(function () {
				// Make sure messages are loaded and init the tool
				if (!window.krMsgs) {
					$.ajax({
						url: '//toolserver.org/~krinkle/I18N/export.php?lang=' +  mw.config.get('wgUserLanguage'),
						type: 'GET',
						dataType: 'script',
						cache: true
					}).done(init);
				} else {
					init();
				}
			});
		}
	});

}(jQuery, mediaWiki));
