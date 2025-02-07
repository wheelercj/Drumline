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
import { getSetting } from './getSetting.js';

const blockButtonEl = document.querySelector('#blockButton');
const refreshButtonEl = document.querySelector('#refreshButton');

let currentTab;
let currentDomain;
let blockedDomains;

async function main() {
    browser.tabs.query({ currentWindow: true, active: true }).then(async tabs => {
        if (!tabs || tabs.length === 0) {
            return;
        }

        currentTab = tabs[0];
        if (!currentTab.url) {
            return;
        }

        currentDomain = new URL(currentTab.url).hostname;
        blockedDomains = await getSetting('blockedDomains');
        if (blockedDomains.includes(currentDomain)) {
            blockButtonEl.textContent = 'Unblock this domain';
        }
    });
}

blockButtonEl.addEventListener('click', async () => {
    // the user wants to block or unblock the current domain

    for (let i = 0; i < blockedDomains.length; i++) {
        // if the current domain is already in the list of blocked domains
        if (blockedDomains[i] === currentDomain) {
            blockedDomains.splice(i, 1); // remove the current domain from the list
            await browser.storage.sync.set({ blockedDomains: blockedDomains });
            blockButtonEl.textContent = 'Block this domain';
            refreshButtonEl.style.display = 'block';
            return;
        }
    }
    // the current domain is not in the list of blocked domains yet

    blockedDomains.push(currentDomain);

    try {
        await browser.storage.sync.set({ blockedDomains: blockedDomains });
    } catch (err) {
        // https://developer.chrome.com/docs/extensions/reference/api/storage#property-sync
        const m = `browser.storage.sync.set: ${err}`;
        console.error(m);
        browser.notifications.create('', {
            type: 'basic',
            iconUrl: 'images/drum-128.png',
            title: 'Error',
            message: m,
        });
    }

    browser.tabs.sendMessage(currentTab.id, {
        destination: 'content',
        category: 'blockCurrentDomain',
        id: Math.random(), // why: https://github.com/Stardown-app/Stardown/issues/98
    });

    blockButtonEl.textContent = 'Unblock this domain';
});

refreshButtonEl.addEventListener('click', async () => {
    // the user wants to reload the current page

    browser.tabs.reload(currentTab.id);
    refreshButtonEl.style.display = 'none';
});

main();
