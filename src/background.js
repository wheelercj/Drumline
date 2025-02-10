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
import { getSetting } from './getSetting.js';

/**
 * @typedef {object} Rule
 * @property {boolean|undefined} blocked - whether the site is blocked all day every day.
 * @property {string|undefined} dailyBlockTimes - e.g. "0-14:30, 22-24".
 * @property {boolean|undefined} tracked
 * @property {string|undefined} dailyTimeLimit - e.g. "0:15" for 15 minutes.
 */

// TODO: decide how to store tracking data. It should probably be stored in local:
// https://developer.chrome.com/docs/extensions/reference/api/storage#property-local

/**
 * @type {Map<string, Rule>} - the keys are hostnames.
 */
const rules = new Map();
loadRules(rules);

/** @type {number|undefined} */
let currentTabId = undefined;

/** @type {string|undefined} */
let currentHostname = undefined;

/**
 * @param {Rule} rule
 * @returns {boolean}
 */
function isCurrentlyBlocked(rule) {
    if (!rule) {
        return false;
    } else if (rule.blocked) {
        return true;
    } else if (rule.dailyBlockTimes) {
        const now = new Date();
        const nowHour = now.getHours();
        const nowMinute = now.getMinutes();

        const timeRanges = rule.dailyBlockTimes.split(',');
        for (let i = 0; i < timeRanges.length; i++) {
            const timeRange = timeRanges[i];
            const times = timeRange.split('-');
            const startTime = times[0];
            const endTime = times[1];
            let startHour = 0;
            let startMinute = 0;
            let endHour = 0;
            let endMinute = 0;
            if (startTime.includes(':')) {
                const startTimeArray = startTime.split(':');
                startHour = parseInt(startTimeArray[0]);
                startMinute = parseInt(startTimeArray[1]);
            } else {
                startHour = parseInt(startTime);
            }
            if (endTime.includes(':')) {
                const endTimeArray = endTime.split(':');
                endHour = parseInt(endTimeArray[0]);
                endMinute = parseInt(endTimeArray[1]);
            } else {
                endHour = parseInt(endTime);
            }

            if (nowHour > startHour && nowHour < endHour) {
                return true;
            } else if (
                startHour === endHour &&
                nowHour === startHour &&
                nowMinute >= startMinute &&
                nowMinute < endMinute
            ) {
                return true;
            } else if (nowHour === startHour && nowMinute >= startMinute) {
                return true;
            } else if (nowHour === endHour && nowMinute < endMinute) {
                return true;
            }
        }
    }

    // TODO: also check dailyTimeLimit

    return false;
}

getCurrentTab(async tab => {
    currentTabId = tab.id;
    if (tab.url) {
        currentHostname = new URL(tab.url).hostname;
    } else {
        currentHostname = undefined;
    }
});

// onActivated fires when the active tab in a window changes, but the tab's URL may not be
// set yet.
browser.tabs.onActivated.addListener(activeInfo => {
    currentTabId = activeInfo.tabId;
    getCurrentTab(async tab => {
        if (tab.url) {
            currentHostname = new URL(tab.url).hostname;
            const rule = rules.get(currentHostname);
            if (isCurrentlyBlocked(rule)) {
                const message = {
                    destination: 'popup',
                    category: 'hostnameIsBlocked',
                };
                if (rule.dailyBlockTimes) {
                    message.dailyBlockTimes = rule.dailyBlockTimes;
                }
                browser.runtime.sendMessage(message).catch(err => {
                    console.log(`background sendMessage to popup: ${err}`);
                });
            }
        } else {
            currentHostname = undefined;
        }
    });
});

// onUpdated fires when a URL is set, but not when the user switches to an existing tab.
// https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onUpdated
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    currentTabId = tabId;
    if (!tab.url) {
        // this should be impossible
        console.error('tab.url is falsy in the tabs.onUpdated listener');
        return;
    }

    currentHostname = new URL(tab.url).hostname;
    const rule = rules.get(currentHostname);

    const message = {
        destination: 'popup',
    };

    if (isCurrentlyBlocked(rule)) {
        message.category = 'hostnameIsBlocked';
        if (rule.dailyBlockTimes) {
            message.dailyBlockTimes = rule.dailyBlockTimes;
        }
        await execBlockScript(rule);
    } else {
        message.category = 'hostnameIsNotBlocked';
    }

    browser.runtime.sendMessage(message).catch(err => {
        if (err.message === 'Could not establish connection. Receiving end does not exist.') {
            // the popup is closed
            return;
        }
        console.log(`background sendMessage to popup: ${err}`);
    });
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.destination !== 'background') {
        return;
    } else if (!currentHostname) {
        console.error('Current hostname is undefined');
        return;
    }

    let rule = rules.get(currentHostname);

    switch (message.category) {
        case 'isHostnameBlocked':
            if (isCurrentlyBlocked(rule)) {
                sendResponse({ answer: 'yes', rule: rule });
                // rule may be undefined
            } else {
                sendResponse({ answer: 'no', rule: rule });
                // rule may be undefined
            }
            break;
        case 'blockCurrentHostnameIndefinitely':
            if (rule) {
                rule.blocked = true;
            } else {
                rule = {
                    blocked: true,
                };
                rules.set(currentHostname, rule);
            }
            execBlockScript(rule);
            saveRules(rules, 'blocked');
            break;
        case 'blockCurrentHostnameAtDailyTimes':
            if (rule) {
                rule.dailyBlockTimes = message.times;
            } else {
                rule = {
                    dailyBlockTimes: message.times,
                };
                rules.set(currentHostname, rule);
            }
            if (isCurrentlyBlocked(rule)) {
                execBlockScript(rule);
            }
            saveRules(rules, 'dailyBlockTimes');
            break;
        case 'unblockCurrentHostname':
            if (!rule) {
                console.error(`No rule found for hostname ${currentHostname}`);
                return;
            }
            delete rule.blocked;
            if (Object.keys(rule).length > 0) {
                rules.delete(currentHostname);
            }
            saveRules(rules, 'blocked');
            break;
        case 'deleteCurrentHostnameDailyBlockRule':
            if (!rule) {
                console.error(`No rule found for hostname ${currentHostname}`);
                return;
            }
            delete rule.dailyBlockTimes;
            if (Object.keys(rule).length > 0) {
                rules.delete(currentHostname);
            }
            saveRules(rules, 'dailyBlockTimes');
            break;
        default:
            console.error(`Unknown message category: ${message.category}`);
            throw new Error(`Unknown message category: ${message.category}`);
    }
});

/**
 * @param {Rule} rule
 * @returns {Promise<void>}
 */
async function execBlockScript(rule) {
    browser.scripting.executeScript({
        target: { tabId: currentTabId },
        func: blockSite,
        args: [rule],
    }).then(injectionResults => {
        for (const { frameId, result } of injectionResults) {
            if (result !== undefined) {
                console.log(`Frame ${frameId} result: ${result}`);
            }
        }
    });
}

/**
 * @param {Rule} rule
 * @returns {Promise<void>}
 */
async function blockSite(rule) {
    document.body.innerHTML = `
        <div style="position: relative; height: 100vh; width: 100%;">
            <h1 style="font-size: x-large; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 100%; text-align: center;">
                You blocked this site with Drumline.
            </h1>
        </div>
    `;
}

/**
 * @param {Map<string, Rule>} rules
 * @param {string} categoryChanged
 */
function saveRules(rules, categoryChanged) {
    switch (categoryChanged) {
        case 'blocked':
            const blockedHostnames = [];
            for (const [hostname, rule] of rules) {
                if (rule.blocked) {
                    blockedHostnames.push(hostname);
                }
            }
            browser.storage.sync.set({ blocked: blockedHostnames.join(' ') })
                .catch(err => {
                    const m = `While saving blocked hostnames: ${err.message}`;
                    console.error(m);
                    browser.notifications.create('', {
                        type: 'basic',
                        iconUrl: 'images/drum-128.png',
                        title: 'Storage error',
                        message: m,
                    });
                });
            break;
        case 'dailyBlockTimes':
            const hostnameTimes = [];
            for (const [hostname, rule] of rules) {
                if (rule.dailyBlockTimes) {
                    hostnameTimes.push(`${hostname} ${rule.dailyBlockTimes}`);
                }
            }
            browser.storage.sync.set({ dailyBlockTimes: hostnameTimes.join('$') })
                .catch(err => {
                    const m = `While saving daily block times: ${err.message}`;
                    console.error(m);
                    browser.notifications.create('', {
                        type: 'basic',
                        iconUrl: 'images/drum-128.png',
                        title: 'Storage error',
                        message: m,
                    });
                });
            break;
        case 'tracked':
            // TODO
            // browser.storage.sync.set({ tracked:  });
            break;
        case 'dailyTimeLimit':
            // TODO
            // browser.storage.sync.set({ dailyTimeLimit:  });
            break;
        default:
            const m = `Unknown setting category: ${categoryChanged}`;
            console.error(m);
            throw m;
    }
}

/**
 * @param {Map<string, Rule>} rules
 */
async function loadRules(rules) {
    const blockedHostnamesStr = await getSetting('blocked');
    if (blockedHostnamesStr) {
        const blockedHostnames = blockedHostnamesStr.split(' ');
        for (let i = 0; i < blockedHostnames.length; i++) {
            const hostname = blockedHostnames[i];
            const rule = rules.get(hostname);
            if (!rule) {
                rules.set(hostname, { blocked: true });
            } else {
                rule.blocked = true;
            }
        }
    }

    const dailyBlockTimesStr = await getSetting('dailyBlockTimes');
    if (dailyBlockTimesStr) {
        const hostnameTimes = dailyBlockTimesStr.split('$');
        for (let i = 0; i < hostnameTimes.length; i++) {
            const [hostname, times] = hostnameTimes[i].split(' ');
            const rule = rules.get(hostname);
            if (!rule) {
                rules.set(hostname, { dailyBlockTimes: times });
            } else {
                rule.dailyBlockTimes = times;
            }
        }
    }

    // TODO: load tracked
    // TODO: load dailyTimeLimit
}
