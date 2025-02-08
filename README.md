# Drumline

A simple browser extension for managing your time on websites of your choice.

- track your time on specific sites
- set daily time limits
- block sites during chosen times of each day, or indefinitely

I'm mainly making this for myself, but maybe it will be helpful to others too. I decided to make this rather than use an existing one because I didn't want to take the security risk of installing someone else's browser extension for something this simple. Feel free to request features but I might decline.

I probably won't publish Drumline to any of the extension stores, but it can be installed manually.

## Install

1. `git clone https://github.com/wheelercj/Drumline.git && cd Drumline`
2. `npm install`
3. `npm run build-firefox` for Firefox or `npm run build-chrome` for a Chromium browser (Chrome, Edge, Brave, Vivaldi, Opera, Arc, etc.)
4. In your browser, open `about:debugging#/runtime/this-firefox` in Firefox or `chrome://extensions/` in a Chromium browser
5. If you're using a Chromium browser, turn on developer mode
6. Click "Load Temporary Add-on..." or "Load unpacked"
7. If in Firefox, select Drumline's `firefox/manifest.json` file. If in a Chromium browser, select Drumline's `chrome` folder
