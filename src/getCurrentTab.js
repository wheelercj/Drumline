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

/**
 * @param {async function(Tab): void} f
 * @returns {Promise<void>}
 */
export async function getCurrentTab(f) {
    browser.tabs.query({ currentWindow: true, active: true }).then(async tabs => {
        if (!tabs) {
            console.warn(`tabs: ${tabs}`);
            return;
        } else if (tabs.length === 0) {
            console.warn('No tabs found');
            return;
        }

        const currentTab = tabs[0];

        await f(currentTab);
    });
}
