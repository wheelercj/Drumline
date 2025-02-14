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

/**
 * @typedef {import('./background.js').Rule} Rule
 */

const refreshButtonEl = document.querySelector('#refreshButton');
const blockButtonEl = document.querySelector('#blockButton');
const blockIndefinitelyEl = document.querySelector('#blockIndefinitely');
const blockAtDailyTimesEl = document.querySelector('#blockAtDailyTimes');
const dailyBlockTimesEl = document.querySelector('#dailyBlockTimes');

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

    /** @type {Rule|undefined} */
    const rule = response.rule;

    if (response.answer === 'yes') {
        if (rule && rule.dailyBlockTimes) {
            blockButtonEl.textContent = 'Remove daily block'
        } else {
            blockButtonEl.textContent = 'Unblock this site';
        }
    } else {
        blockButtonEl.textContent = 'Block this site';
    }

    if (!rule) {
        return;
    }

    // show in the popup the current settings for this site
    if (rule.dailyBlockTimes) {
        dailyBlockTimesEl.value = rule.dailyBlockTimes;
        blockAtDailyTimesEl.checked = true;
        blockIndefinitelyEl.checked = false;
    }
}

browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.destination !== 'popup') {
        return;
    }

    switch (message.category) {
        case 'hostnameIsBlocked':
            blockButtonEl.textContent = 'Unblock this site';
            if (message.dailyBlockTimes) {
                dailyBlockTimesEl.value = message.dailyBlockTimes;
            }
            break;
        case 'hostnameIsNotBlocked':
            blockButtonEl.textContent = 'Block this site';
            break;
        default:
            console.error(`Unknown message category: ${message.category}`);
            throw new Error(`Unknown message category: ${message.category}`);
    }
});

blockButtonEl.addEventListener('click', async () => {
    // block or unblock the current site, or delete the site rule

    if (blockButtonEl.textContent === 'Block this site') {
        refreshButtonEl.style.visibility = 'hidden'; // hide the refresh button
        if (blockIndefinitelyEl.checked) {
            blockButtonEl.textContent = 'Unblock this site';
            browser.runtime.sendMessage({
                destination: 'background',
                category: 'blockCurrentHostnameIndefinitely',
            });
        } else if (blockAtDailyTimesEl.checked) {
            blockButtonEl.textContent = 'Remove daily block';
            const times = dailyBlockTimesEl.value.replaceAll(' ', '');
            await validateTimes(times);
            browser.runtime.sendMessage({
                destination: 'background',
                category: 'blockCurrentHostnameAtDailyTimes',
                times: times,
            });
        } else {
            throw 'Not implemented';
        }
    } else if (blockButtonEl.textContent === 'Unblock this site') {
        refreshButtonEl.style.visibility = 'visible'; // show the refresh button
        blockButtonEl.textContent = 'Block this site';
        browser.runtime.sendMessage({
            destination: 'background',
            category: 'unblockCurrentHostname',
        });
    } else if (blockButtonEl.textContent === 'Remove daily block') {
        blockButtonEl.textContent = 'Block this site';
        browser.runtime.sendMessage({
            destination: 'background',
            category: 'deleteCurrentHostnameDailyBlockRule',
        });
    } else {
        throw `Unknown block button text: ${blockButtonEl.textContent}`;
    }
});

refreshButtonEl.addEventListener('click', async () => {
    // reload the current page

    await getCurrentTab(async currentTab => {
        browser.tabs.reload(currentTab.id);
    });
    refreshButtonEl.style.visibility = 'hidden'; // hide the refresh button
});

/**
 * @param {string} title
 * @param {string} message
 * @returns {Promise<void>}
 */
async function showNotification(title, message) {
    browser.notifications.create('', {
        type: 'basic',
        iconUrl: 'images/drum-128.png',
        title: title,
        message: message,
    });
}

/**
 * validateTimes validates the times input and, if needed, shows the user a notification
 * with an error message and throws an error.
 * @param {string} timesRangesStr
 * @returns {Promise<void>}
 * @throws {string}
 */
async function validateTimes(timesRangesStr) {
    const timeRanges = timesRangesStr.split(',');
    for (let i = 0; i < timeRanges.length; i++) {
        const timeRange = timeRanges[i];
        const times = timeRange.split('-');
        if (times.length !== 2) {
            const m = 'Any time entered must be in ranges';
            await showNotification('Input error', m);
            throw `Input error: ${m}`;
        }

        const startTime = times[0].split(':'); // [hour] or [hour, minute]
        const endTime = times[1].split(':'); // [hour] or [hour, minute]
        await validateTime(startTime, 'Start', i);
        await validateTime(endTime, 'End', i);
        const startTimeHour = parseInt(startTime[0]);
        const endTimeHour = parseInt(endTime[0]);
        if (startTimeHour > endTimeHour) {
            const m = `Each time range's start must be less than its end`;
            await showNotification('Input error', m);
            throw `Input error: ${m}`;
        } else if (startTimeHour === endTimeHour) {
            let startTimeMinute = 0;
            let endTimeMinute = 0;
            if (startTime.length === 2) {
                startTimeMinute = parseInt(startTime[1]);
            }
            if (endTime.length === 2) {
                endTimeMinute = parseInt(endTime[1]);
            }
            if (startTimeMinute >= endTimeMinute) {
                const m = `Each time range's start must be less than its end`;
                await showNotification('Input error', m);
                throw `Input error: ${m}`;
            }
        }
    }
}

/**
 * validateTime validates the time input and, if needed, shows the user a notification
 * with an error message and throws an error.
 * @param {string[]} time - the hour, or the hour and minute.
 * @param {string} name - a name for the time to use in error messages.
 * @param {number} rangeIndex - the index of the range the time is in.
 * @returns {Promise<void>}
 * @throws {string}
 */
async function validateTime(time, name, rangeIndex) {
    if (time.length > 2) {
        const m = `${name} time in time range with index ${rangeIndex} must have zero or one colon`;
        await showNotification('Input error', m);
        throw `Input error: ${m}`;
    }

    const hour = time[0];
    await validateTimeHand(name, hour, 'hour', rangeIndex);
    if (time.length === 2) {
        const minute = time[1];
        await validateTimeHand(name, minute, 'minute', rangeIndex);
    }
}

/**
 * validateTimeHand validates the hour or minute input and, if needed, shows the user a
 * notification with an error message and throws an error.
 * @param {string} timeName - a name for the time to use in error messages.
 * @param {string} hand - the hour or the minute.
 * @param {string} handName - "hour" or "minute".
 * @param {number} rangeIndex - the index of the range the time is in.
 * @returns {Promise<void>}
 * @throws {string}
 */
async function validateTimeHand(timeName, hand, handName, rangeIndex) {
    const handInt = parseInt(hand);

    let errorMessage = undefined;
    if (hand.length === 0) {
        errorMessage = 'not be empty';
    } else if (isNaN(handInt)) {
        errorMessage = 'be an integer';
    } else if (handInt < 0) {
        errorMessage = 'not be negative';
    } else if (handName === 'hour' && handInt > 24) {
        errorMessage = 'not be greater than 24';
    } else if (handName === 'minute' && handInt > 59) {
        errorMessage = 'not be greater than 59';
    }

    if (errorMessage) {
        errorMessage = `${timeName} time's ${handName} in time range with index ${rangeIndex} must ` + errorMessage;
        await showNotification('Input error', errorMessage);
        throw `Input error: ${errorMessage}`;
    }
}

main();
