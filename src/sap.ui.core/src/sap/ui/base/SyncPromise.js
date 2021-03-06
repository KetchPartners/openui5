/*!
 * ${copyright}
 */

sap.ui.define([
], function () {
	"use strict";

	/**
	 * Returns a SyncPromise wrapping the given promise <code>oPromise</code>, or
	 * <code>oPromise</code> if it is already a SyncPromise, or fulfilling with the given result.
	 * Note that "thenables" are not supported!
	 *
	 * @param {Promise|SyncPromise|any} [oPromise]
	 *   The promise to wrap or the result to synchronously fulfill with
	 * @returns {SyncPromise}
	 *   The SyncPromise
	 */
	function resolve(oPromise) {
		return oPromise instanceof SyncPromise ? oPromise : new SyncPromise(oPromise);
	}

	/**
	 * Constructor for a SyncPromise to wrap the given promise in order to observe settlement and
	 * provide synchronous access to the result.
	 *
	 * Implements https://github.com/promises-aplus/promises-spec except:
	 * <ul>
	 * <li> "4. onFulfilled or onRejected
	 * must not be called until the execution context stack contains only platform code."
	 * <li> Interoperability is limited to <code>Promise</code> instances (use
	 * <code>Promise.resolve</code> to wrap e.g. a <code>jQuery.Deferred</code> instance).
	 * </ul>
	 *
	 * @param {Promise|SyncPromise|any} [oPromise]
	 *   The promise to wrap or the result to synchronously fulfill with; may be omitted if and
	 *   only if <code>aValues</code> is provided
	 * @param {function} [fnCallback]
	 *   Function to apply to the result of the SyncPromise to be wrapped; requires
	 *   <code>oPromise</code>
	 * @param {any[]} [aValues]
	 *   The values to be combined via the static method <code>SyncPromise.all</code>; assumes that
	 *   <code>oPromise</code> and <code>fnCallback</code> are both omitted (<code>null</code>)
	 * @param {boolean} [bReject=false]
	 *   Whether to reject the new promise with the reason <code>oPromise</code>
	 * @returns {SyncPromise}
	 *   The SyncPromise created
	 *
	 * @private
	 * @restricted sap.ui.core,sap.ui.dt,sap.ui.model
	 */
	function SyncPromise(oPromise, fnCallback, aValues, bReject) {
		var bFulfilled = false,
			iPending,
			bRejected = false,
			that = this,
			vResult = that; // "pending"

		// needed for SyncPromise.all()
		function checkFulfilled() {
			if (iPending === 0) {
				vResult = aValues;
				bFulfilled = true;
			}
		}

		if (bReject) {
			vResult = oPromise;
			bRejected = true;
		} else if (aValues) {
			iPending = aValues.length; // number of pending promises
			checkFulfilled();
			aValues.forEach(function (oValue, i) {
				resolve(oValue).then(function (vResult0) {
					aValues[i] = vResult0;
					iPending -= 1;
					checkFulfilled();
				}, function (vReason) {
					if (!bRejected) {
						vResult = vReason;
						bRejected = true;
					}
				});
			});
		} else if (typeof fnCallback === "function") {
			try {
				vResult = fnCallback(oPromise.getResult());
				bFulfilled = true;
				oPromise = null; // be nice to the garbage collector
				if (vResult instanceof Promise || vResult instanceof SyncPromise) {
					return new SyncPromise(vResult);
				}
			} catch (e) {
				vResult = e;
				bRejected = true;
				oPromise = null;
			}
		} else if (oPromise instanceof Promise || oPromise instanceof SyncPromise) {
			oPromise.then(function (vResult0) {
				vResult = vResult0;
				bFulfilled = true;
				oPromise = null;
			}, function (vReason) {
				vResult = vReason;
				bRejected = true;
				oPromise = null;
			});
		} else {
			vResult = oPromise;
			bFulfilled = true;
		}

		/**
		 * @returns {any}
		 *   The result in case this SyncPromise is already fulfilled or <code>this</code> if it is
		 *   still pending
		 */
		this.getResult = function () {
			return vResult;
		};

		/**
		 * @returns {boolean}
		 *   Whether this SyncPromise is fulfilled
		 */
		this.isFulfilled = function () {
			return bFulfilled;
		};

		/**
		 * @returns {boolean}
		 *   Whether this SyncPromise is rejected
		 */
		this.isRejected = function () {
			return bRejected;
		};

		/**
		 * @param {function} [fnOnFulfilled]
		 *   Callback function if this SyncPromise is fulfilled
		 * @param {function} [fnOnRejected]
		 *   Callback function if this SyncPromise is rejected
		 * @returns {SyncPromise}
		 *   A new SyncPromise
		 */
		this.then = function (fnOnFulfilled, fnOnRejected) {
			if (bFulfilled || bRejected) {
				return new SyncPromise(that, bFulfilled ? fnOnFulfilled : fnOnRejected);
			}
			if (!oPromise) {
				// iPending > 0 ==> aValues contains pending promises
				oPromise = Promise.all(aValues);
			}
			return new SyncPromise(oPromise.then(fnOnFulfilled, fnOnRejected));
		};
	}

	/**
	 * @param {function} [fnOnRejected]
	 *   Callback function if this SyncPromise is rejected
	 * @returns {SyncPromise}
	 *   A new SyncPromise
	 */
	SyncPromise.prototype.catch = function (fnOnRejected) {
		return this.then(undefined, fnOnRejected);
	};

	/**
	 * @returns {boolean}
	 *   Whether this SyncPromise is still pending
	 */
	SyncPromise.prototype.isPending = function () {
		return this.getResult() === this;
	};

	/**
	 * Returns a string representation of this SyncPromise.
	 * If this SyncPromise is resolved a String representation of the result is returned,
	 * if it is rejected a String representation of the error is returned.
	 *
	 * @return {string} A string description of this SyncPromise
	 */
	SyncPromise.prototype.toString = function () {
		if (this.isPending()) {
			return "SyncPromise: pending";
		}
		return String(this.getResult());
	};

	return {
		/**
		 * Returns a new SyncPromise for the given array of values just like
		 * <code>Promise.all(aValues)</code>. Note that iterables are not supported!
		 *
		 * @param {any[]} aValues
		 *   The values
		 * @returns {SyncPromise}
		 *   The SyncPromise
		 *
		 * @private
		 * @restricted sap.ui.core,sap.ui.dt,sap.ui.model
		 */
		all : function (aValues) {
			return new SyncPromise(null, null, aValues.slice());
		},

		/**
		 * Returns a SyncPromise that is rejected with the given reason.
		 *
		 * @param {any} [vReason]
		 *   The reason for rejection
		 * @returns {SyncPromise}
		 *   The SyncPromise
		 *
		 * @private
		 * @restricted sap.ui.core,sap.ui.dt,sap.ui.model
		 */
		reject : function (vReason) {
			return new SyncPromise(vReason, null, null, true);
		},

		/**
		 * Returns a SyncPromise wrapping the given promise <code>oPromise</code>, or
		 * <code>oPromise</code> if it is already a SyncPromise, or fulfilling with the given result.
		 * Note that thenables are not supported!
		 *
		 * @param {Promise|SyncPromise|any} [oPromise]
		 *   The promise to wrap or the result to synchronously fulfill with
		 * @returns {SyncPromise}
		 *   The SyncPromise
		 *
		 * @private
		 * @restricted sap.ui.core,sap.ui.dt,sap.ui.model
		 */
		resolve : resolve
	};
}/*, bExport = false*/);
