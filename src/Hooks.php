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

		$out->addModules( 'ext.pricemonTicker' );
	}
}
