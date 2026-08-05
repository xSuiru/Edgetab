const { chromium } = require("playwright");

const TARGET_URL = "https://example.com";
const FOLLOWER_COUNT = 2;

(async () => {
    const browser = await chromium.launch({
        channel: "msedge",
        headless: false
    });

    // One context for now. We can switch to separate sessions later.
    const context = await browser.newContext();

    // --------------------------------------------------
    // Create Master
    // --------------------------------------------------

    const master = await context.newPage();

    // --------------------------------------------------
    // Create Followers
    // --------------------------------------------------

    const followers = [];

    for (let i = 0; i < FOLLOWER_COUNT; i++) {
        const follower = await context.newPage();
        followers.push(follower);
    }

    // --------------------------------------------------
    // Node function called by the Master webpage
    // --------------------------------------------------

    await master.exposeFunction("sendToFollowers", async (event) => {
        console.log("MASTER EVENT:", event);

        if (event.type === "click") {
            await Promise.allSettled(
                followers.map(async (follower, index) => {
                    try {
                        // Only synchronize when URL matches
                        if (
                            normalizeUrl(follower.url()) !==
                            normalizeUrl(master.url())
                        ) {
                            console.log(
                                `Follower ${index + 1}: URL does not match`
                            );

                            return;
                        }

                        const element = follower.locator(event.selector).first();

                        await element.waitFor({
                            state: "attached",
                            timeout: 1000
                        });

                        await element.click({
                            timeout: 2000
                        });

                        console.log(
                            `Follower ${index + 1}: click replayed`
                        );
                    } catch (error) {
                        console.log(
                            `Follower ${index + 1}: click failed`,
                            error.message
                        );
                    }
                })
            );
        }
    });

    // --------------------------------------------------
    // Install listener BEFORE pages load
    // --------------------------------------------------

    await master.addInitScript(() => {
        function escapeCSS(value) {
            if (window.CSS && CSS.escape) {
                return CSS.escape(value);
            }

            return value.replace(
                /([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g,
                "\\$1"
            );
        }

        function createSelector(element) {
            if (!element || element.nodeType !== Node.ELEMENT_NODE) {
                return null;
            }

            // Prefer ID
            if (element.id) {
                return "#" + escapeCSS(element.id);
            }

            // Prefer useful test attributes
            const usefulAttributes = [
                "data-testid",
                "data-test",
                "data-sync-id"
            ];

            for (const attribute of usefulAttributes) {
                const value = element.getAttribute(attribute);

                if (value) {
                    const selector =
                        `[${attribute}="${CSS.escape(value)}"]`;

                    if (document.querySelectorAll(selector).length === 1) {
                        return selector;
                    }
                }
            }

            // Name
            if (element.getAttribute("name")) {
                const name = element.getAttribute("name");

                const selector =
                    `${element.tagName.toLowerCase()}` +
                    `[name="${CSS.escape(name)}"]`;

                if (document.querySelectorAll(selector).length === 1) {
                    return selector;
                }
            }

            // Build CSS path
            const path = [];

            let current = element;

            while (
                current &&
                current.nodeType === Node.ELEMENT_NODE
            ) {
                let selector = current.tagName.toLowerCase();

                if (current.id) {
                    selector = "#" + escapeCSS(current.id);
                    path.unshift(selector);
                    break;
                }

                const parent = current.parentElement;

                if (!parent) {
                    path.unshift(selector);
                    break;
                }

                const sameTags = Array.from(parent.children).filter(
                    child => child.tagName === current.tagName
                );

                if (sameTags.length > 1) {
                    const index = sameTags.indexOf(current) + 1;

                    selector +=
                        `:nth-of-type(${index})`;
                }

                path.unshift(selector);

                current = parent;
            }

            return path.join(" > ");
        }

        // --------------------------------------------------
        // Capture real human clicks
        // --------------------------------------------------

        document.addEventListener(
            "click",
            event => {
                const selector = createSelector(event.target);

                if (!selector) {
                    return;
                }

                window.sendToFollowers({
                    type: "click",
                    selector: selector,
                    button: event.button,
                    ctrl: event.ctrlKey,
                    shift: event.shiftKey,
                    alt: event.altKey,
                    meta: event.metaKey
                });
            },
            true
        );

        console.log("TabSync master listener installed.");
    });

    // --------------------------------------------------
    // Open website
    // --------------------------------------------------

    await master.goto(TARGET_URL);

    for (const follower of followers) {
        await follower.goto(TARGET_URL);
    }

    console.log("");
    console.log("==============================");
    console.log(" TabSync is running");
    console.log("==============================");
    console.log("MASTER:", master.url());
    console.log("FOLLOWERS:", followers.length);
    console.log("");
    console.log("Manually use the MASTER tab.");
    console.log("Clicks will be sent to followers.");
    console.log("");

    // Keep Node alive until browser closes
    await new Promise(resolve => {
        browser.on("disconnected", resolve);
    });
})();

function normalizeUrl(url) {
    try {
        const parsed = new URL(url);

        parsed.hash = "";

        return parsed.toString();
    } catch {
        return url;
    }
}