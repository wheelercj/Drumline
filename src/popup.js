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
let currentHostname;
let blockedHostnames;

async function main() {
    browser.tabs.query({ currentWindow: true, active: true }).then(async tabs => {
        if (!tabs || tabs.length === 0) {
            return;
        }

        currentTab = tabs[0];
        if (!currentTab.url) {
            return;
        }

        currentHostname = new URL(currentTab.url).hostname;
        blockedHostnames = await getSetting('blockedHostnames');
        if (blockedHostnames.includes(currentHostname)) {
            blockButtonEl.textContent = 'Unblock this site';
        }
    });
}

blockButtonEl.addEventListener('click', async () => {
    // the user wants to block or unblock the current site

    for (let i = 0; i < blockedHostnames.length; i++) {
        // if the current hostname is already in the list of blocked hostnames
        if (blockedHostnames[i] === currentHostname) {
            console.log('hostname is blocked');
            blockedHostnames.splice(i, 1); // remove the current hostname from the list
            await browser.storage.sync.set({ blockedHostnames: blockedHostnames });
            blockButtonEl.textContent = 'Block this site';
            refreshButtonEl.style.display = 'block';
            return;
        }
    }
    // the current hostname is not in the list of blocked hostnames yet
    console.log('hostname is not blocked');




    // Get arrays containing new and old rules
    const newRules = [{
        id: 1,
        priority: 1,
        action: {
            type: 'redirect',
            redirect: { extensionPath: '/redirectTarget.html' },
        },
        condition: {
            urlFilter: `||${currentHostname}/*`,
            resourceTypes: ['main_frame'],
        },
    }];
    const oldRules = await browser.declarativeNetRequest.getDynamicRules();
    const oldRuleIds = oldRules.map(rule => rule.id);

    // Use the arrays to update the dynamic rules
    await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: oldRuleIds,
        addRules: newRules
    });



    const request = {
        initiator: location.href,
        // method: 'get',
        tabId: currentTab.id,
        type: 'main_frame',
        url: '/redirectTarget.html',
    };
    let result = undefined;
    try {
        result = await browser.declarativeNetRequest.testMatchOutcome(request);
        console.log(`result: ${result}`);
        console.log(`result.matchedRules: ${result.matchedRules}`);
        console.log(`result.matchedRules.length: ${result.matchedRules.length}`);
    } catch (err) {
        console.error(`testMatchOutcome: ${err}`);
    }




    // blockedHostnames.push(currentHostname);

    // try {
    //     await browser.storage.sync.set({ blockedHostnames: blockedHostnames });
    // } catch (err) {
    //     // https://developer.chrome.com/docs/extensions/reference/api/storage#property-sync
    //     const m = `browser.storage.sync.set: ${err}`;
    //     console.error(m);
    //     browser.notifications.create('', {
    //         type: 'basic',
    //         iconUrl: 'images/drum-128.png',
    //         title: 'Error',
    //         message: m,
    //     });
    // }

    // browser.tabs.sendMessage(currentTab.id, {
    //     destination: 'content',
    //     category: 'blockCurrentHostname',
    //     id: Math.random(), // why: https://github.com/Stardown-app/Stardown/issues/98
    // });

    blockButtonEl.textContent = 'Unblock this site';
});

refreshButtonEl.addEventListener('click', async () => {
    // the user wants to reload the current page

    browser.tabs.reload(currentTab.id);
    refreshButtonEl.style.display = 'none';
});

main();
