/*!
 * PricemonTicker — sticky top bar with live BTC prices.
 *
 * Polls {base}/api/current/?base=BTC&quote=<FIAT>&... every PricemonTickerRefreshMs.
 * Reads three config vars (set by the BeforePageDisplay hook):
 *   wgPricemonTickerBase, wgPricemonTickerRefreshMs, wgPricemonTickerPairs
 *
 * @license GPL-2.0-or-later
 */
( function () {
	'use strict';

	var base = mw.config.get( 'wgPricemonTickerBase' );
	var refreshMs = parseInt( mw.config.get( 'wgPricemonTickerRefreshMs' ), 10 ) || 15000;
	var pairs = mw.config.get( 'wgPricemonTickerPairs' ) || [
		[ 'USD', '$' ],
		[ 'EUR', '€' ]
	];

	if ( !base ) {
		return;
	}

	// Build the bar once, attach it to <html> so it survives skin chrome.
	var bar = document.createElement( 'div' );
	bar.id = 'pm-ticker';
	bar.setAttribute( 'role', 'status' );
	bar.setAttribute( 'aria-live', 'polite' );

	var html = '<span class="pm-ticker-label">BTC</span>';
	pairs.forEach( function ( p ) {
		var fiat = p[ 0 ];
		var sym = p[ 1 ];
		html += '<span class="pm-ticker-pair" data-fiat="' + fiat + '">' +
			'<span class="pm-ticker-sym">' + sym + '</span>' +
			'<span class="pm-ticker-val">—</span>' +
			'</span>';
	} );
	html += '<span class="pm-ticker-age" aria-hidden="true">·</span>';
	bar.innerHTML = html;

	function attach() {
		// Insert the bar as the very first child of <body>. It lives in normal
		// document flow, so it occupies its own vertical space, pushes wiki
		// chrome down naturally, and scrolls away on scroll. We do NOT touch
		// the skin's positioning — every overlap fight we tried (CSS overrides,
		// runtime scans for fixed/sticky/absolute headers, position: relative
		// promotion) broke on at least one skin variant. Stop fighting the DOM.
		document.body.insertBefore( bar, document.body.firstChild );
	}
	if ( document.body ) {
		attach();
	} else {
		document.addEventListener( 'DOMContentLoaded', attach );
	}

	var prev = Object.create( null );

	function fmt( n ) {
		return Number( n ).toLocaleString( undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		} );
	}

	function findRow( rows, fiat ) {
		for ( var i = 0; i < rows.length; i++ ) {
			if ( rows[ i ].base === 'BTC' && rows[ i ].fiat === fiat ) {
				return rows[ i ];
			}
		}
		return null;
	}

	function render( data ) {
		var rows = ( data && data.weighted_fiat ) || [];

		pairs.forEach( function ( p ) {
			var fiat = p[ 0 ];
			var pairEl = bar.querySelector( '.pm-ticker-pair[data-fiat="' + fiat + '"]' );
			if ( !pairEl ) {
				return;
			}
			var valEl = pairEl.querySelector( '.pm-ticker-val' );
			var row = findRow( rows, fiat );

			if ( !row || row.price == null ) {
				valEl.textContent = '—';
				pairEl.classList.remove( 'pm-up', 'pm-down', 'pm-stale' );
				return;
			}

			var price = parseFloat( row.price );
			if ( !isFinite( price ) ) {
				valEl.textContent = '—';
				return;
			}

			valEl.textContent = fmt( price );

			// Fallback flag means the row was filled from a stored minute aggregate
			// instead of live state — dim it so users know it's not fresh.
			pairEl.classList.toggle( 'pm-stale', !!row.fallback );
			if ( row.fallback && row.fallback_minute_start ) {
				pairEl.setAttribute( 'title',
					'Fallback from minute aggregate starting ' + row.fallback_minute_start );
			} else {
				pairEl.removeAttribute( 'title' );
			}

			var p0 = prev[ fiat ];
			if ( typeof p0 === 'number' && p0 !== price ) {
				pairEl.classList.remove( 'pm-up', 'pm-down' );
				// Force reflow so the CSS transition restarts.
				void pairEl.offsetWidth;
				pairEl.classList.add( price > p0 ? 'pm-up' : 'pm-down' );
			}
			prev[ fiat ] = price;
		} );

		var ageEl = bar.querySelector( '.pm-ticker-age' );
		if ( ageEl ) {
			ageEl.textContent = '· updated ' + new Date().toLocaleTimeString();
		}
	}

	function markOffline() {
		var ageEl = bar.querySelector( '.pm-ticker-age' );
		if ( ageEl ) {
			ageEl.textContent = '· offline';
		}
	}

	function poll() {
		var q = pairs.map( function ( p ) { return 'quote=' + encodeURIComponent( p[ 0 ] ); } ).join( '&' );
		var url = base + '/api/current/?base=BTC&' + q;

		// `credentials: 'omit'` keeps this a simple CORS request and avoids
		// sending wiki session cookies to the pricemon origin.
		fetch( url, { credentials: 'omit', cache: 'no-store' } )
			.then( function ( r ) {
				if ( !r.ok ) {
					throw new Error( 'HTTP ' + r.status );
				}
				return r.json();
			} )
			.then( render )
			.catch( markOffline );
	}

	poll();
	var timer = setInterval( poll, refreshMs );

	// Pause polling when the tab is hidden; resume (with an immediate poll) when it comes back.
	document.addEventListener( 'visibilitychange', function () {
		if ( document.hidden ) {
			clearInterval( timer );
			timer = null;
		} else if ( !timer ) {
			poll();
			timer = setInterval( poll, refreshMs );
		}
	} );
}() );
