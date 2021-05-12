// ==UserScript==
// @name            Twitch Follower Count
// @namespace       https://github.com/aranciro/
// @version         0.1.16
// @license         GPL-3.0-or-later; https://www.gnu.org/licenses/gpl-3.0.txt
// @description     Browser userscript that shows follower count next to channel name in a twitch channel page.
// @author          aranciro
// @homepage        https://github.com/aranciro/Twitch-Follower-Count
// @supportURL      https://github.com/aranciro/Twitch-Follower-Count/issues
// @updateURL       https://raw.githubusercontent.com/aranciro/Twitch-Follower-Count/master/twitch-follower-count.user.js
// @downloadURL     https://raw.githubusercontent.com/aranciro/Twitch-Follower-Count/master/twitch-follower-count.user.js
// @icon            https://github.com/aranciro/Twitch-Follower-Count/raw/master/res/twitch-follower-count-icon32.png
// @icon64          https://github.com/aranciro/Twitch-Follower-Count/raw/master/res/twitch-follower-count-icon64.png
// @require         https://openuserjs.org/src/libs/sizzle/GM_config.min.js
// @grant           GM_getValue
// @grant           GM_setValue
// @grant           GM_registerMenuCommand
// @include         *://*.twitch.tv/*
// @run-at          document-idle
// ==/UserScript==

const configLiterals = {
  smallFontSize: "Small",
  mediumFontSize: "Medium",
  bigFontSize: "Big",
  positionChannelName: "Next to channel name",
  positionFollowButton: "Left of the follow button",
};

GM_config.init({
  id: "Twitch_Follower_Count_config",
  title: "Twitch Follower Count - Configuration",
  fields: {
    fontSize: {
      label: "Font size",
      type: "select",
      options: [
        configLiterals.smallFontSize,
        configLiterals.mediumFontSize,
        configLiterals.bigFontSize,
      ],
      default: configLiterals.mediumFontSize,
      title: "Select the follower count font size",
    },
    position: {
      label: "Position",
      type: "select",
      options: [
        configLiterals.positionChannelName,
        configLiterals.positionFollowButton,
      ],
      default: configLiterals.positionChannelName,
      title: "Select where the follower count should appear",
    },
    localeString: {
      type: "checkbox",
      default: true,
      label: "Format the follower count (puts thousands separator etc.)",
      title:
        "Uncheck if you don't want the follower count to have separator for thousands",
    },
    enclosed: {
      type: "checkbox",
      default: false,
      label: "Parenthesize the follower count",
      title: "Parenthesize the follower count",
    },
  },
});

GM_registerMenuCommand("Configure Twitch Follower Count", () => {
  GM_config.open();
});

const fontSizeMap = {
  [configLiterals.smallFontSize]: "5",
  [configLiterals.mediumFontSize]: "4",
  [configLiterals.bigFontSize]: "3",
};

const config = {
  fontSize: fontSizeMap[GM_config.get("fontSize")],
  insertNextToFollowButton:
    configLiterals.positionFollowButton === GM_config.get("position"),
  localeString: GM_config.get("localeString"),
  enclosed: GM_config.get("enclosed"),
};

let currentChannel = "";
const channelNameNodeSelector = "div.tw-align-items-center.tw-flex > a > h1";
const channelPartnerBadgeNodeSelector =
  "div.tw-align-items-center.tw-flex > div.tw-align-items-center.tw-c-text-link.tw-flex.tw-full-height.tw-mg-l-05 > figure > svg";
const divWithButtonsSelector =
  "div.metadata-layout__support.tw-align-items-baseline.tw-flex.tw-flex-wrap-reverse.tw-justify-content-between > div.tw-flex.tw-flex-grow-1.tw-justify-content-end";
const updatingCounterAnimationCSS =
  ".updating-counter {\r\n  animation: blinker 1s linear infinite;\r\n}\r\n\r\n@keyframes blinker {  \r\n  50% { opacity: 0; }\r\n}";
const followerCountNodeName = "ChannelFollowerCount";

const run = () => {
  const updatingCounterStyleNode = document.createElement("style");
  updatingCounterStyleNode.innerHTML = updatingCounterAnimationCSS;
  document.head.appendChild(updatingCounterStyleNode);
  const channelNameNode = document.querySelector(channelNameNodeSelector);
  if (channelNameNode) {
    const channelName = channelNameNode.innerText;
    const followerCountNodes = document.getElementsByName(
      followerCountNodeName
    );
    const followerCountNodesExist = followerCountNodes.length > 0;
    if (currentChannel !== channelName || !followerCountNodesExist) {
      if (followerCountNodesExist) {
        followerCountNodes[0].classList.add("updating-counter");
      }
      currentChannel = channelName;
      getFollowerCount(channelName)
        .then((response) => handleFollowerCountAPIResponse(response))
        .catch((error) => {
          console.error(error);
        });
    }
  }
};

(() => {
  console.log("Twitch Follower Count userscript - START");
  try {
    run();
    setInterval(function () {
      run();
    }, 5000);
  } catch (e) {
    console.log("Twitch Follower Count userscript - STOP (EXCEPTION) ");
    console.log(e);
  }
})();

const responseIsValid = (response) => {
  return (
    response &&
    Array.isArray(response) &&
    response.length > 0 &&
    "data" in response[0] &&
    "user" in response[0].data &&
    "followers" in response[0].data.user &&
    "totalCount" in response[0].data.user.followers &&
    response[0].data.user.followers.totalCount
  );
};

const handleFollowerCountAPIResponse = (response) => {
  if (!responseIsValid(response)) {
    console.error(response);
    const errorMessage = "Invalid response body";
    throw new Error(errorMessage);
  }
  const followers = response[0].data.user.followers.totalCount;
  const followerCountNodes = document.getElementsByName(followerCountNodeName);
  const followerCountNodesExist = followerCountNodes.length > 0;
  if (followerCountNodesExist) {
    followerCountNodes.forEach((fcNode) => fcNode.remove());
  }
  insertFollowerCountNode(followers);
};

const getFollowerCount = async (channelName) => {
  const url = "https://gql.twitch.tv/gql";
  const requestBody = JSON.stringify([
    {
      operationName: "ChannelPage_ChannelFollowerCount",
      variables: {
        login: channelName,
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash:
            "87f496584ac60bcfb00db2ce59054b73155f297f1796e5e2418d685213233ad9",
        },
      },
    },
  ]);
  const followerCountResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Content-type": "application/json",
      "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
    },
    body: requestBody,
  });
  if (followerCountResponse.ok) {
    let followerCountResponseBody = await followerCountResponse.json();
    return followerCountResponseBody;
  } else {
    console.error(followerCountResponse);
    const errorMessage = `Endpoint responded with status: ${followerCountResponse.status}`;
    throw new Error(errorMessage);
  }
};

const createFollowerCountTextNode = (followers) => {
  let followersText = followers;
  if (config.localeString) {
    followersText = Number(followersText).toLocaleString();
  }
  if (config.enclosed) {
    followersText = `(${followersText})`;
  }
  return document.createTextNode(followersText);
};

const createFollowerCountNode = (followers, fontSize) => {
  const followerCountTextNode = createFollowerCountTextNode(followers);
  const followerCountNode = document.createElement("h2");
  followerCountNode.setAttribute("name", followerCountNodeName);
  followerCountNode.classList.add(
    "tw-c-text-alt-2",
    `tw-font-size-${fontSize}`,
    "tw-semibold"
  );
  followerCountNode.style.marginLeft = "1rem";
  followerCountNode.style.marginRight = "1rem";
  followerCountNode.style.display = "inline-block";
  followerCountNode.appendChild(followerCountTextNode);
  return followerCountNode;
};

const createFollowerCountContainerNode = (followerCountNode) => {
  const followerCountContainerNode = document.createElement("div");
  followerCountContainerNode.style.display = "flex";
  followerCountContainerNode.style.alignItems = "center";
  followerCountContainerNode.appendChild(followerCountNode);
  return followerCountContainerNode;
};

const insertFollowerCountNode = (followers) => {
  const channelNameNode = document.querySelector(channelNameNodeSelector);
  channelNameNode.style.display = "inline-block";
  const channelPartnerBadgeNode = document.querySelector(
    channelPartnerBadgeNodeSelector
  );
  const followerCountNode = createFollowerCountNode(followers, config.fontSize);
  if (config.insertNextToFollowButton) {
    const divWithButtons = document.querySelector(divWithButtonsSelector);
    const followerCountContainerNode =
      createFollowerCountContainerNode(followerCountNode);
    divWithButtons.insertBefore(
      followerCountContainerNode,
      divWithButtons.firstChild
    );
  } else if (channelPartnerBadgeNode) {
    channelPartnerBadgeNode.parentNode.insertBefore(
      followerCountNode,
      channelPartnerBadgeNode.nextSibling
    );
  } else {
    channelNameNode.parentNode.insertBefore(
      followerCountNode,
      channelNameNode.nextSibling
    );
  }
};
