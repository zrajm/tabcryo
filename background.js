//-*- js-indent-level: 2 -*-

import { $ } from './elemental.mjs'

// Return a Base64 encoded random string with 22 chars (132 bit). Uses stong
// randomness everywhere possible. Uses RCF4648 version of Base64 encoding
// (file and URL safe) and never includes padding. Characters used are
// [a-zA-z0-9_-] (= 6 bit per character).
const random132BitString = (crypto => () => {
  // 17 bytes = 136 bit (cut down to 132 bit in the end).
  let bytes = new Uint8Array(17)

  // Build array of byte numbers.
  bytes = (crypto && crypto.getRandomValues)            // crypto interface
    ? crypto.getRandomValues(bytes)                     //   good random bytes
    : bytes.map(() => Math.floor(Math.random() * 256))  //   builtin (insecure)

  const string = String.fromCharCode.apply(null, bytes)
  return btoa(string)                                     // base64 encode
    .slice(0, 22)                                         // 22 chars = 132 bit
    .replace(/[+\/]/g, c => ({ '+': '-', '/': '_' })[c])  // file & URL safe
  }
)(window.crypto || window.msCrypto)

/******************************************************************************/

// Update tab.
// FOR DEBUGGING:
// * browser.storage.local.get(x => { delete x._; console.log(JSON.stringify(x,0,1)) })
// * browser.storage.local.clear()
function tabChanged(tabId, changeInfo, tab) {
  if (tab.url && tab.title) {
    // FIXME: Currently using tabId as histId here, but should be smarter in
    // the end (because tabIds are reused by browser, and we don't want
    // collisions).
    const { title, url, lastAccessed, windowId, index } = tab
    histPush(`${tabId}`, { title, url, lastAccessed }, { tabId, windowId, index })
  }
}

// Append <state> to specified history. Updates last history entry, or append
// new entry. (If state.url is the same as the 'url' property of the last entry
// in the specified history, then that entry is updated with provided info.
// Otherwise a new history entry is added.)
function histPush(histId, state, globs = {}) {
  // FIXME: This is not race-safe, if called in quick succession then previous
  // instances will clobber later instances (because of async issues). Maybe
  // cash stuff to be written in an object, and use setTimeout() to write it
  // only when browser goes idle?

  browser.storage.local.get({ [histId]: [globs] }).then(data => {
    const hist = data[histId]
    const last = hist[hist.length - 1]
    if (last && last.url === state.url) { // same url: update
      Object.assign(last, state)
    } else {                              // different url: add
      data[histId].push(state)
    }
    browser.storage.local.set(data)
  })
}

// Archive tab.
function tabClosed(tabId, removeInfo) {
  const histId = `${tabId}`
  browser.storage.local.get(histId).then(({ [histId]: o }) => {
    if (o === undefined) { return }
    o[0].tabId = undefined
    o[0].windowId = undefined
    o[0].index = undefined
    browser.storage.local.set({ [random132BitString()]: o })
    //browser.storage.local.set({ [`_${tabId}`]: o })
    browser.storage.local.remove(histId)
  })
}

/*===========================================================================*/
/* Main */
(() => {
  $(browser.tabs).on('removed', tabClosed)
  $(browser.tabs).on('updated', tabChanged, { properties: ['status'] }) //, 'url', 'title'] })
})()

//[eof]
