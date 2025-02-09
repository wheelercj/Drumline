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

import { browser } from './browserSpecific.js';
import { getCurrentTab } from './getCurrentTab.js';

const blockButtonEl = document.querySelector('#blockButton');
const refreshButtonEl = document.querySelector('#refreshButton');

async function main() {
    const response = await browser.runtime.sendMessage({
        destination: 'background',
        category: 'isHostnameBlocked',
    });
    if (!response) {
        const m = `response: ${response}`;
        console.error(m);
        throw m;
    }

    if (response.answer === 'yes') {
        blockButtonEl.textContent = 'Unblock this site';
    }
}

browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.destination !== 'popup') {
        return;
    }

    switch (message.category) {
        case 'hostnameIsBlocked':
            blockButtonEl.textContent = 'Block this site';
            refreshButtonEl.style.visibility = 'hidden'; // hide the refresh button
            break;
        case 'hostnameIsNotBlocked':
            blockButtonEl.textContent = 'Unblock this site';
            refreshButtonEl.style.visibility = 'hidden'; // hide the refresh button
            break;
        default:
            console.error(`Unknown message category: ${message.category}`);
            throw new Error(`Unknown message category: ${message.category}`);
    }
});

blockButtonEl.addEventListener('click', async () => {
    // block or unblock the current site

    if (blockButtonEl.textContent === 'Block this site') {
        blockButtonEl.textContent = 'Unblock this site';
        browser.runtime.sendMessage({
            destination: 'background',
            category: 'blockCurrentHostname',
        });
    } else {
        refreshButtonEl.style.visibility = 'visible'; // show the refresh button
        blockButtonEl.textContent = 'Block this site';
        browser.runtime.sendMessage({
            destination: 'background',
            category: 'unblockCurrentHostname',
        });
    }
});

refreshButtonEl.addEventListener('click', async () => {
    // reload the current page

    await getCurrentTab(async currentTab => {
        browser.tabs.reload(currentTab.id);
    });
    refreshButtonEl.style.visibility = 'hidden'; // hide the refresh button
});

main();
