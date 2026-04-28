// Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { CONNECT_CONFIG } from "../config";
import { DEPRECATED_CONNECT_DOMAIN } from "../constants";

export const isValidURL = (url) => {
  const regexp =
    /^(?:(?:https?|ftp):\/\/)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/\S*)?$/;
  if (regexp.test(url)) return true;
  return false;
};

export const getConnectInstanceURL = () => {
  let connectInstanceURL = CONNECT_CONFIG.connectInstanceURL?.replace(/\/$/, "");
  if (!connectInstanceURL) {
    console.warn("connectInstanceURL not set!");
    return null;
  }

  if (connectInstanceURL.endsWith(DEPRECATED_CONNECT_DOMAIN)) connectInstanceURL = `${connectInstanceURL}/connect`;
  return connectInstanceURL;
};

const getConnectLoginURL = () => {
  const connectInstanceURL = getConnectInstanceURL();
  if (!connectInstanceURL) return null;
  return `${connectInstanceURL}/login`;
};

const getConnectLogoutURL = () => {
  const connectInstanceURL = getConnectInstanceURL();
  if (!connectInstanceURL) return null;
  return `${connectInstanceURL}/logout`;
};

const getConnectCCPURL = () => {
  const connectInstanceURL = getConnectInstanceURL();
  if (!connectInstanceURL) return null;
  return `${connectInstanceURL}/ccp-v2`;
};

export const getConnectURLS = () => {
  return {
    connectInstanceURL: getConnectInstanceURL(),
    connectLoginURL: getConnectLoginURL(),
    connectLogoutURL: getConnectLogoutURL(),
    connectCCPURL: getConnectCCPURL(),
  };
};

export const goToHome = () => {
  window.location.href = `${window.location.protocol}//${window.location.host}`;
};

export function addUpdateQueryStringKey(key, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.pushState({}, "", url.toString());
}

export function getQueryStringValueByKey(key) {
  const url = new URL(window.location.href);
  return url.searchParams.get(key);
}

export function addUpdateLocalStorageKey(key, value) {
  window.localStorage.setItem(key, value);
}

export function getLocalStorageValueByKey(key) {
  return window.localStorage.getItem(key);
}

export function base64ToArrayBuffer(base64) {
  var binary_string = window.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

/**
 * Check if object is empty.
 * @param {object} inputObject - inputObject.
 * @returns {boolean} - true if object is empty, false otherwise.
 */
export function isObjectEmpty(inputObject) {
  return inputObject != null && Object.keys(inputObject).length === 0 && Object.getPrototypeOf(inputObject) === Object.prototype;
}

/**
 * Check if object is undefined, null, empty.
 * @param {object} inputObject - inputObject.
 * @returns {boolean} - true if object is undefined, null, empty, false otherwise.
 */
export function isObjectUndefinedNullEmpty(inputObject) {
  if (inputObject == null) return true;
  if (typeof inputObject !== "object") return true;
  if (typeof inputObject === "object" && inputObject instanceof Array) return true;
  return isObjectEmpty(inputObject);
}

/**
 * Check if string is undefined, null, empty.
 * @param {string} inputString - inputString.
 * @returns {boolean} - true if string is undefined, null, empty, false otherwise.
 */
export function isStringUndefinedNullEmpty(inputString) {
  if (inputString == null) return true;
  if (typeof inputString !== "string") return true;
  if (inputString.trim().length === 0) return true;
  return false;
}

/**
 * Check if inputFunction is a function.
 * @param {function} inputFunction - inputFunction.
 * @returns {boolean} - true if inputFunction is a function, false otherwise.
 */
export function isFunction(inputFunction) {
  return inputFunction && {}.toString.call(inputFunction) === "[object Function]";
}

export function isDevEnvironment() {
  if (import.meta.env.DEV) {
    console.info("Running in development mode (Vite dev server)");
    return true;
  }
  return false;
}

/**
 * Check if debug mode is enabled via URL parameter (?debug=true)
 * @returns {boolean} - true if ?debug=true is present in URL
 */
export function isDebugMode() {
  const debugParam = getQueryStringValueByKey('debug');
  return debugParam === 'true';
}

const eosPunctuation = [
  // Latin
  '\u0021', '\u002E', '\u003F',
  // Armenian, Arabic, Urdu
  '\u0589', '\u061F', '\u06D4',
  // Syriac
  '\u0700', '\u0701', '\u0702', '\u07F9',
  // Devanagari
  '\u0964', '\u0965',
  // Myanmar
  '\u104A', '\u104B',
  // Ethiopic
  '\u1362', '\u1367', '\u1368', '\u166E',
  // Mongolian
  '\u1803', '\u1809',
  // Tai Le
  '\u1944', '\u1945',
  // Buginese
  '\u1AA8', '\u1AA9', '\u1AAA', '\u1AAB',
  // Javanese
  '\u1B5A', '\u1B5B', '\u1B5E', '\u1B5F',
  // Cham
  '\u1C3B', '\u1C3C', '\u1C7E', '\u1C7F',
  // Miscellaneous
  '\u203C', '\u203D', '\u2047', '\u2048', '\u2049', '\u2E2E', '\u2E3C',
  // CJK
  '\u3002', '\uA4FF',
  // Vai, Bamum
  '\uA60E', '\uA60F', '\uA6F3', '\uA6F7',
  // Phags-pa
  '\uA876', '\uA877',
  // Saurashtra
  '\uA8CE', '\uA8CF', '\uA92F',
  // Kayah Li, Rejang
  '\uA9C8', '\uA9C9',
  // Cham
  '\uAA5D', '\uAA5E', '\uAA5F', '\uAAF0', '\uAAF1', '\uABEB',
  // Fullwidth
  '\uFE52', '\uFE56', '\uFE57', '\uFF01', '\uFF0E', '\uFF1F', '\uFF61',
  // Astral plane scripts
  '\u{10A56}', '\u{10A57}', '\u{10F55}', '\u{10F56}', '\u{10F57}', '\u{10F58}', '\u{10F59}',
  '\u{11047}', '\u{11048}', '\u{110BE}', '\u{110BF}', '\u{110C0}', '\u{110C1}',
  '\u{11141}', '\u{11142}', '\u{11143}', '\u{111C5}', '\u{111C6}', '\u{111CD}', '\u{111DE}', '\u{111DF}',
  '\u{11238}', '\u{11239}', '\u{1123B}', '\u{1123C}', '\u{112A9}',
  '\u{1145A}', '\u{1145B}', '\u{115C2}', '\u{115C3}', '\u{115C9}', '\u{115D7}',
  '\u{11641}', '\u{11642}', '\u{1173C}', '\u{1173D}', '\u{1173E}',
  '\u{11A42}', '\u{11A43}', '\u{11A9B}', '\u{11A9C}',
  '\u{11C41}', '\u{11C42}', '\u{11EF7}', '\u{11EF8}',
  '\u{16A6E}', '\u{16A6F}', '\u{16AF5}', '\u{16B37}', '\u{16B38}', '\u{16B44}',
  '\u{16E98}', '\u{1BC9F}', '\u{1DA88}',
].join('');

const EOS_REGEX = new RegExp(`[${eosPunctuation}]\\s*$`, 'u');

export function endsWithEOSPunctuation(text) {
    return EOS_REGEX.test(text);
}
