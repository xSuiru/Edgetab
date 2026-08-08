# Edgetab

Edgetab is a local Playwright script that opens Microsoft Edge with one master page and several follower pages. Use the master page, and mouse, wheel, and keyboard input will be replayed in the follower pages.

This repository also includes a minimal `manifest.json` so the folder can load as an unpacked browser extension, but the current working tool is the Node/Playwright script.

## Clone

Clone the repository and enter the project folder:

```powershell
git clone https://github.com/xSuiru/Edgetab
cd Edgetab
```

## Install

Install dependencies once:

```powershell
npm install
```

## Run

Start with the default site:

```powershell
npm start
```

By default, this opens:

- Target: `https://www.instantwar.com/`
- Master pages: `1`
- Follower pages: `2`
- Viewport: `1280x720`

Use the master Edge window. Input from that window is replayed into the follower windows.

## Use A Different Site

Pass a URL after `node index.js`:

```powershell
node index.js https://example.com
```

Or set `TARGET_URL`:

```powershell
$env:TARGET_URL="https://example.com"
npm start
```

## Change Follower Count

```powershell
$env:FOLLOWERS="4"
npm start
```

## Change Window Size

```powershell
$env:WIDTH="1366"
$env:HEIGHT="768"
npm start
```

## Stop

In the PowerShell window where the script is running, press:

```powershell
Ctrl + C
```

If PowerShell asks `Terminate batch job (Y/N)?`, type `Y` and press Enter.

You can also close the Edge windows opened by the script.

## Load As An Unpacked Extension

The folder can be loaded in Chrome or Edge from the Extensions page:

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `D:\GitHub\Edgetab`.

The extension currently has no browser UI or behavior. Use the Playwright script above for tab syncing.
