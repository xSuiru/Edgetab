const { chromium } = require("playwright");

const TARGET_URL =
    process.argv[2] ||
    process.env.TARGET_URL ||
    "https://www.instantwar.com/";

const FOLLOWER_COUNT = Number(process.env.FOLLOWERS || 2);
const VIEWPORT = {
    width: Number(process.env.WIDTH || 1280),
    height: Number(process.env.HEIGHT || 720)
};

const BUTTONS = ["left", "middle", "right"];

(async () => {
    const browser = await chromium.launch({
        channel: "msedge",
        headless: false,
        args: [
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
            "--disable-backgrounding-occluded-windows"
        ]
    });

    const masterContext = await browser.newContext({
        viewport: VIEWPORT
    });

    const followerContexts = await Promise.all(
        Array.from({ length: FOLLOWER_COUNT }, () =>
            browser.newContext({
                viewport: VIEWPORT
            })
        )
    );

    const master = await masterContext.newPage();
    const followers = await Promise.all(
        followerContexts.map(context => context.newPage())
    );

    let followerQueue = Promise.resolve();

    await master.exposeFunction("sendToFollowers", event => {
        followerQueue = followerQueue
            .then(() => replayEventOnFollowers(followers, event))
            .catch(error => {
                console.log("Follower replay failed:", error.message);
            });

        return followerQueue;
    });

    await master.addInitScript(() => {
        let lastMove = 0;

        function send(event) {
            if (!window.sendToFollowers) {
                return;
            }

            window.sendToFollowers(event).catch(() => {});
        }

        function modifiers(event) {
            return {
                ctrl: event.ctrlKey,
                shift: event.shiftKey,
                alt: event.altKey,
                meta: event.metaKey
            };
        }

        function mouseEvent(type, event) {
            return {
                type,
                x: event.clientX,
                y: event.clientY,
                button: event.button,
                ...modifiers(event)
            };
        }

        window.addEventListener(
            "pointerdown",
            event => send(mouseEvent("pointerdown", event)),
            true
        );

        window.addEventListener(
            "pointerup",
            event => send(mouseEvent("pointerup", event)),
            true
        );

        window.addEventListener(
            "pointermove",
            event => {
                const now = performance.now();

                if (now - lastMove < 16) {
                    return;
                }

                lastMove = now;
                send(mouseEvent("pointermove", event));
            },
            true
        );

        window.addEventListener(
            "wheel",
            event => {
                send({
                    type: "wheel",
                    x: event.clientX,
                    y: event.clientY,
                    deltaX: event.deltaX,
                    deltaY: event.deltaY,
                    ...modifiers(event)
                });
            },
            true
        );

        window.addEventListener(
            "keydown",
            event => {
                if (event.repeat) {
                    return;
                }

                send({
                    type: "keydown",
                    key: event.key,
                    code: event.code,
                    ...modifiers(event)
                });
            },
            true
        );

        window.addEventListener(
            "keyup",
            event => {
                send({
                    type: "keyup",
                    key: event.key,
                    code: event.code,
                    ...modifiers(event)
                });
            },
            true
        );

        console.log("Instant War input sync listener installed.");
    });

    await Promise.all([
        master.goto(TARGET_URL, { waitUntil: "domcontentloaded" }),
        ...followers.map(follower =>
            follower.goto(TARGET_URL, { waitUntil: "domcontentloaded" })
        )
    ]);

    console.log("");
    console.log("==============================");
    console.log(" Instant War TabSync is running");
    console.log("==============================");
    console.log("TARGET:", TARGET_URL);
    console.log("MASTER:", master.url());
    console.log("FOLLOWERS:", followers.length);
    console.log("VIEWPORT:", `${VIEWPORT.width}x${VIEWPORT.height}`);
    console.log("");
    console.log("Use the MASTER window.");
    console.log("Mouse, drag, wheel, and keyboard input will be replayed.");
    console.log("");

    await new Promise(resolve => {
        browser.on("disconnected", resolve);
    });
})();

async function replayEventOnFollowers(followers, event) {
    await Promise.allSettled(
        followers.map(async (follower, index) => {
            try {
                await replayEvent(follower, event);
            } catch (error) {
                console.log(
                    `Follower ${index + 1}: ${event.type} failed`,
                    error.message
                );
            }
        })
    );
}

async function replayEvent(page, event) {
    switch (event.type) {
        case "pointermove":
            await page.mouse.move(event.x, event.y);
            break;

        case "pointerdown":
            await page.mouse.move(event.x, event.y);
            await page.mouse.down({
                button: toPlaywrightButton(event.button)
            });
            break;

        case "pointerup":
            await page.mouse.move(event.x, event.y);
            await page.mouse.up({
                button: toPlaywrightButton(event.button)
            });
            break;

        case "wheel":
            await page.mouse.move(event.x, event.y);
            await page.mouse.wheel(event.deltaX, event.deltaY);
            break;

        case "keydown":
            await page.keyboard.down(toPlaywrightKey(event));
            break;

        case "keyup":
            await page.keyboard.up(toPlaywrightKey(event));
            break;
    }
}

function toPlaywrightButton(button) {
    return BUTTONS[button] || "left";
}

function toPlaywrightKey(event) {
    if (event.key && event.key !== "Dead") {
        return event.key;
    }

    return event.code;
}
