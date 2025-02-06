/*
   Copyright 2025 Chris Wheeler

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

import { getSetting } from './getSetting.js';

function setUpListeners() {
    browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
        if (message.destination !== 'content') {
            return;
        }

        // In Chromium, this listener must be synchronous and must send a response
        // immediately. True must be sent if the actual response will be sent
        // asynchronously.
        handleRequest(message).then(res => {
            sendResponse(res);
        });

        return true; // needed to keep the message channel open for async responses
    });
}

// Chromium requires setUpListeners to be called when the window loads. If it's only
// called immediately, the content script will not be able to receive messages and no
// error message will appear. It's fine to also call it immediately.
window.onload = setUpListeners;

// Firefox requires setUpListeners to be called immediately. If it's only called in
// window.onload, the content script will not be able to receive messages and an error
// message will appear: "Error: Could not establish connection. Receiving end does not
// exist." Firefox also requires setUpListeners to NOT be called in window.onload, or
// else pressing Stardown's copy shortcut for some sites will show the error message
// "Clipboard write is not allowed" even though writing to the clipboard is still
// successful. The bundle script should comment out the `window.onload` assignment for
// Firefox.
setUpListeners();

/**
 * lastRequestId is the ID of the last request sent from background.js to content.js. It
 * is used to prevent duplicate requests from being processed. This is necessary because
 * Chromium duplicates requests for some reason, which can cause the wrong output
 * configuration to be used if not handled carefully. More details in
 * https://github.com/Stardown-app/Stardown/issues/98.
 * @type {number|null}
 */
let lastRequestId = null;

async function main() {
    const blockedDomains = await getSetting('blockedDomains');

    if (blockedDomains.includes(location.hostname)) {
        await blockDomain();
    }
}

/**
 * handleRequest processes a message from another execution context and returns a
 * response.
 * @param {object} message - the received message object. Must have `category` and `id`
 * properties and may have other properties depending on the category.
 * @param {string} message.category - the category of the message.
 * @param {number} message.id - the ID of the message.
 * @returns {Promise<ContentResponse|null>}
 */
async function handleRequest(message) {
    if (message.id === lastRequestId) {
        console.log(`Ignoring duplicate request: ${message.category}`);
        return null;
    }
    lastRequestId = message.id;

    switch (message.category) {
        case 'blockCurrentDomain':
            await blockDomain();
            break;
        default:
            console.error(`Unknown message category: ${message.category}`);
            throw new Error(`Unknown message category: ${message.category}`);
    }
}

async function blockDomain() {
    document.body.innerHTML = `
        <div style="position: relative; height: 100vh; width: 100%;">
            <h1 style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 100%; text-align: center;">
                You blocked this domain with Drumline.
            </h1>
        </div>
    `;
}

main();
