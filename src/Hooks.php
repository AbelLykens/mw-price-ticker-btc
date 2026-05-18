<?php
/**
 * PricemonTicker — sticky top bar showing live BTC prices.
 *
 * @file
 * @license GPL-2.0-or-later
 */

namespace MediaWiki\Extension\PricemonTicker;

use MediaWiki\Hook\BeforePageDisplayHook;
use OutputPage;
use Skin;

class Hooks implements BeforePageDisplayHook {

	/**
	 * Inject the ticker bar resources on every page.
	 *
	 * Exposes three JS config vars so the front-end can read them via
	 * mw.config.get(...):
	 *   - wgPricemonTickerBase       (string)  base URL of the pricemon instance
	 *   - wgPricemonTickerRefreshMs  (int)     poll interval in milliseconds
	 *   - wgPricemonTickerPairs      (array)   [ [fiat, symbol], ... ]
	 *
	 * @param OutputPage $out
	 * @param Skin       $skin
	 * @return void
	 */
	public function onBeforePageDisplay( $out, $skin ): void {
		$cfg  = $out->getConfig();
		$base = rtrim( (string)$cfg->get( 'PricemonTickerBase' ), '/' );

		// If no base URL is configured, do nothing — leaves the wiki untouched.
		if ( $base === '' ) {
			return;
		}

		$out->addJsConfigVars( [
			'wgPricemonTickerBase'      => $base,
			'wgPricemonTickerRefreshMs' => (int)$cfg->get( 'PricemonTickerRefreshMs' ),
			'wgPricemonTickerPairs'     => $cfg->get( 'PricemonTickerPairs' ),
		] );

		// Load the CSS synchronously in <head> so body padding and skin-chrome
		// offsets are applied before first paint — without this, the page renders
		// at viewport y=0, then jumps down 28px when ticker.js runs and the styles
		// module finishes loading. Render-blocking is acceptable here: the CSS is
		// tiny (~2 KB) and avoids a visible reflow on every page load.
		$out->addModuleStyles( 'ext.pricemonTicker' );

		// JS still loads async via mw.loader after the document is interactive.
		$out->addModules( 'ext.pricemonTicker' );
	}
}
