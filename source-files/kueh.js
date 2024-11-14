/*
    TODO:
    - ! Allow user to enable (or even specify) easing in / out options (Implement animation for exiting with easing)
    - Additional option to link message buffer to number of messages / message size? e.g. if emotes are spammed in a raid then they can fill the screen
    - Consider using a more "consistent" method for adding images to text (since badge and emote adding functions do it differently)
    - Consider how to deal with text outline a bit more (just leave the colour up to the user?)
    - Possibly implement "deflection" physics? Make messages "deflect" each other within a certain radius so that they don't overlap and are easier to read
    - Modify the easing animations to account for different speeds so that it is more fluid
*/



/*  
    ========================
        GLOBAL VARIABLES
    ========================
*/

/*
    JSON Field Data
*/

// Whole Message Appearance
let minScaleFactor, hiddenAccs, hideCommands, enableOutline, outlineColor, outlineThickness, enableTextDropShadow, textShadowColor, textShadowAngle;

// Whole Message Behaviour
let parallaxAmount, globalMsgSpeed, enableMsgBuffer, preBufferMsgLimit;

// Username Appearance
let usernameColorOption, defaultUsernameColor, showUserBadges;

// Message Body Appearance
let charLimitDisplayOption, bodyCharLimit;

/* 
    Message Buffer Values
*/

const msgQueue = [];  // Message buffer queue
let onscreenMsgs = 0; // Number of onscreen messages



/*  
    ==================
        EVENT CODE
    ==================
*/  

// Initialise JSON field data variables
window.addEventListener("onWidgetLoad", (obj) => {
    // Store field data object in conveniently-accessible variable
    const fieldData = obj.detail.fieldData;

    // Whole Message Appearance
    minScaleFactor = fieldData.MinScaleFactor;
    hiddenAccs = fieldData.HiddenAccounts?.split(/,\s|,/g);
    hideCommands = fieldData.HideCommands;
    enableOutline = fieldData.EnableOutline;
    outlineColor = fieldData.OutlineColor;
    outlineThickness = fieldData.OutlineThickness
    enableTextDropShadow = fieldData.EnableTextDropShadow;
    textShadowColor = fieldData.TextShadowColor;
    textShadowAngle = fieldData.TextShadowAngle;

    // Whole Message Behaviour
    parallaxAmount = fieldData.ParallaxAmount;
    globalMsgSpeed = fieldData.GlobalMsgSpeed;
    enableMsgBuffer = fieldData.EnableMsgBuffer;
    preBufferMsgLimit = fieldData.PreBufferMsgLimit;

    // Username Appearance
    usernameColorOption = fieldData.UsernameColorOption;
    defaultUsernameColor = fieldData.DefaultUsernameColor;
    showUserBadges = fieldData.ShowUserBadges;

    // Message Body Appearance
    bodyCharLimit = fieldData.BodyCharLimit;
    charLimitDisplayOption = fieldData.CharLimitDisplayOption
});

window.addEventListener("onEventReceived", (msgObj) => {
    if (msgObj?.detail?.listener?.toUpperCase() !== "MESSAGE") return;

    // Check if message fulfills necessary criteria to be displayed in the first place
    const msgData = msgObj.detail.event.data;
    if (hiddenAccs?.includes(msgData.displayName)) return; 
    if (hideCommands && msgData.text[0] === "!") return;   
    if (msgData.text.length > bodyCharLimit && charLimitDisplayOption === "no_display") return;

    // Handle message queueing
    if (onscreenMsgs >= preBufferMsgLimit && enableMsgBuffer) {
        msgQueue.push(msgObj);
    }
    else {
        handleMsgDisplay(msgObj);
    }
});



/* 
    ============================
        FUNCTION DEFINITIONS
    ============================
*/

/* TODO: JAVADOC FOR THIS FUNC */
function handleMsgDisplay(msgObj) {
    const msgData = msgObj.detail.event.data;
    let msgDiv = createMsgDiv(msgData);
    document.querySelector(".main-container").appendChild(msgDiv);
    onscreenMsgs++;

    // Must be set after appending because offset distances unknown before div is rendered in DOM
    setMessageHeight(msgDiv);
    const finalAnim = setAnimation(msgDiv);

    // When the final animation (i.e. the one that brings the message offscreen ends)
    finalAnim.finished.then((msgObj) => {
        // Remove current message from DOM and dequeue next message waiting to be displayed
        document.getElementById(msgData.msgId).remove();
        onscreenMsgs--;
        handleMsgDisplay(msgQueue.shift());
    });
}

/**
 * Creates a div to represent the entire message (username + message body).
 * 
 * @param {object} msgData an object holding the message data from the StreamElements API.
 * @returns the entire message div object.
 */
function createMsgDiv(msgData) {
    
    /* Whole Message */
    let msgDiv = document.createElement("div"); // Create the main message div
    msgDiv.id = msgData.msgId;                  // Set unique message ID for when it is needed  
    msgDiv.className = "msgDiv";                // Set class
    setAnimation(msgDiv);                       // Set animation + parallax effect
    handleOutline(msgDiv);                      // Handle rendering the outline of the message

    /* Message Username */
    let usernameDiv = createUsernameDiv(msgData);

    /* Message Body */
    let msgBodyDiv = createMsgBodyDiv(msgData);

    /* Putting it All Together */
    msgDiv.appendChild(usernameDiv);
    msgDiv.appendChild(msgBodyDiv);
    return msgDiv;
}

/**
 * Creates a div to represent the username,
 * 
 * @param {object} msgData an object holding the message data from the StreamElements API.
 * @returns the username div object.
 */
function createUsernameDiv(msgData) {
    let div = document.createElement("div");
    div.className = "username";

    if (showUserBadges) { addUserBadges(div, msgData); } 

    // Holds color value to assign to style.color
    let setColor = "";
    if (msgData.displayColor) {
        setColor = msgData.displayColor;
    }
    else if (usernameColorOption === "twitch") {
        // Create object to store the default Twitch colors
        const twitchColors = {
            Red: "#FF0000",
            Blue: "#0000FF",
            Green: "#00FF00",
            FireBrick: "#B22222",
            Coral: "#FF7F50",
            YellowGreen: "#9ACD32",
            OrangeRed: "#FF4500",
            SeaGreen: "#2E8B57",
            GoldenRod: "#DAA520",
            Chocolate: "#D2691E",
            CadetBlue: "#5F9EA0",
            DodgerBlue: "#1E90FF",
            HotPink: "#FF69B4",
            BlueViolet: "#8A2BE2",
            SpringGreen: "#00FF7F"
        };

        // Select random color from object and then set that as the username colour
        const colorKeys = Object.keys(twitchColors);
        setColor = colorKeys[ Math.round(boundedRandom(0, colorKeys.length)) ];
    }
    else if (usernameColorOption === "default_color") {
        setColor = defaultUsernameColor;
    }
    div.style.color = setColor;

    // Append username text to div
    let username = document.createElement("p");
    username.innerText = escapeText(msgData.displayName);    
    div.appendChild(username);

    return div;
}

/**
 * Creates a div to represent the message body text.
 * 
 * @param {object} msgData an object holding the message data from the StreamElements API.
 * @returns the message body div object.
 */
function createMsgBodyDiv(msgData) {
    // Create div object
    let div = document.createElement("div");
    div.className = "msgBody";

    let msgTextElement = document.createElement("p");

    // Create varaible for storing modifed message body text
    let msgText = escapeText(msgData.text);

    // Only consider display options if char limit surpassed
    if (msgData.text.length > bodyCharLimit) {
        if (charLimitDisplayOption === "simple_truncate") {
            msgText = msgText.slice(0, bodyCharLimit);
        }
        else if (charLimitDisplayOption === "ellipsis_truncate") {
            msgText = msgText.slice(0, bodyCharLimit) + "...";
        }
    }
    msgTextElement.innerHTML = `: ${escapeText(msgText)}`;

    addEmotes(msgTextElement, msgData); // Add emotes to the message body after setting the inner text
    div.appendChild(msgTextElement);

    return div;
}

/**
 * Sets the font size and animation stylings for the whole chat message.
 * 
 * @param {object} msgDiv object that represents the entire message div.
 */
function setAnimation(msgDiv) {
    const size = boundedRandom(minScaleFactor, 1);
    msgDiv.style.fontSize = `${size}em`;

    
    setAppearEaseAnimation(msgDiv);
    return rightToLeftAnimation(msgDiv, size);
}

/* TODO: JAVADOC FOR THIS FUNC */
function setAppearEaseAnimation(msgDiv) {
    const time = 0.5;
    const startPos = 100; // in vw
    const endPos = 80;    // in vw
    const keyframes = [
        { left: `${startPos}vw` },
        { left: `${endPos}vw` } 
    ];

    msgDiv.animate(
        keyframes, 
        {
            duration: time * 1000, // in ms
            easing: "cubic-bezier(.24,.59,.33,.67)",
            fill: "forwards"
        }
    );
}

/* TODO: JAVADOC FOR THIS FUNC */
function rightToLeftAnimation(msgDiv, size) {
    const time = calcParallaxTime(size, parallaxAmount);
    const startPos = 80; // in vw
    const endPos = (-(msgDiv.offsetWidth / window.innerWidth) * 100) - 10; // in vw ("margin of error" offset of 10)
    const keyframes = [
        { left: `${startPos}vw` },
        { left: `${endPos}vw` } 
    ];

    // Add and then return (as an object) the animation
    return msgDiv.animate(
        keyframes, 
        {
            duration: time * 1000, // in ms
            easing: "linear",
            fill: "forwards",
            delay: 0.5 * 1000
        }
    );
}

/**
 * Sets the whole message height to a random value (adjusted to fit within the screen).
 * 
 * @param {object} msgDiv object that represents the entire message div.
 */
function setMessageHeight(msgDiv) {
    const maxHeight = window.innerHeight - msgDiv.offsetHeight; // Ensure it doesn't go out off screen at the bottom (space added to top of text)
    const randomHeight = Math.random() * maxHeight;
    msgDiv.style.top = `${randomHeight}px`;
}

/**
 * Adds any user badges to the username div.
 * 
 * @param {object} usernameDiv object that represents the username div.
 * @param {object} msgData an object holding the message data from the StreamElements API.
 * @returns nothing (if there's no badges to add)
 */
function addUserBadges(usernameDiv, msgData) {
    // Check if there exist badges to add
    if (!msgData.badges) return;

    for (let badge of msgData.badges) {
        let badgeImg = document.createElement("img");
        badgeImg.src = badge.url;
		badgeImg.className = "badge";

        usernameDiv.appendChild(badgeImg);
    }
}

/**
 * Adds emote images to the message body text.
 * 
 * @param {*} msgTextElement HTML element representing the message body text. 
 * @param {*} msgData an object holding the message data from the StreamElements API.
 * @returns nothing (if there's no emotes to add).
 */
function addEmotes(msgTextElement, msgData) {
    if (!msgData.emotes) return;

    for (let emote of msgData.emotes) {
        let emoteImg = `<img class="emote" src="${emote.urls["4"]}" />`;
        msgTextElement.innerHTML = msgTextElement.innerHTML.replace(emote.name, emoteImg);
    }
}

/**
 * Escapes / sanitises the message body text to prevent XSS attacks.
 * 
 * @param {string} text text to escape / sanitise.
 * @returns the escaped text.
 */
function escapeText(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/`/g, "&#96;");
}

/**
 * Generates a random real value between a lower and upper bound value.
 * 
 * @param {number} minSize lower bound.
 * @param {number} maxSize upper bound.
 * @returns random real value.
 */
function boundedRandom(minSize, maxSize) {
    return Math.random() * (maxSize - minSize) + minSize;
}

/**
 * Handles the outline and drop shadow for the entire message.
 * 
 * @param {object} msgDiv object that represents the entire message div.
 */
function handleOutline(msgDiv) {
    // Initialise to include "actual" drop shadow for the text
    let shadow = "";

    // Set the drop shadow if enabled
    if (enableTextDropShadow) {
        shadow =  `3px 3px 3px ${textShadowColor}`
    }

    // If text outline enabled, add "outline" shadow
    if (enableOutline) {
        // If handleShadow didn't return an empty string (falsey)
        if (shadow) shadow += ", ";

        // "Outline" shadow styling
        shadow += `
        -${outlineThickness}px -${outlineThickness}px 0 ${outlineColor}, 
         0                     -${outlineThickness}px 0 ${outlineColor}, 
         ${outlineThickness}px -${outlineThickness}px 0 ${outlineColor}, 
         ${outlineThickness}px  0                     0 ${outlineColor}, 
         ${outlineThickness}px  ${outlineThickness}px 0 ${outlineColor}, 
         0                      ${outlineThickness}px 0 ${outlineColor}, 
        -${outlineThickness}px  ${outlineThickness}px 0 ${outlineColor}, 
        -${outlineThickness}px  0                     0 ${outlineColor}`;
    }

    msgDiv.style.textShadow = shadow;
}

/**
 * Handles the parallax calculations for a message.
 * 
 * @param {number} size the size of the message (relative to the font size).
 * @param {number} amount the parallax amount / strength.
 * @returns the time (in seconds) for the animation to complete.
 */
function calcParallaxTime(size, amount) {
    /* 
        Explanation of parallax calculation:
        -> globalMsgSpeed * speedFactor         [final speed is relative to global speed * a size-dependent factor value]
        -> speedFactor = (1 - size) * amount    [the closer the size is to 100% / 1, the lesser the effect; the higher the amount, the more the effect]
    */ 
    const adjustedSpeed = globalMsgSpeed * (1 - 
        ((1 - size) * amount)
    );

    // Time (s) = Distance (px) / Speed (px/s)
    return window.innerWidth / adjustedSpeed;
}