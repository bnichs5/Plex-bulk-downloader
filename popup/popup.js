let status = document.getElementById("status");
let downloadBtn = document.getElementById("startDownload");
let cancelBtn = document.getElementById("cancelDownload");

// debug stuff
let count = 0; let debug = false; let debugP = document.getElementById("debug");
if (debug) { debugP.hidden = false; }

function escapeWinDir(path) {
    path = path.replace(/([:])/g, " -");
    path = path.replace(/([/\\|])/g, "_");
    path = path.replace(/([<>"?*])/g, "'");

    return path;
}

/**
 * Listener for the token send back by the content script running on the Plex site
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (debug && request.recipient === 'debug') {
        count++;
        debugP.innerText += (count + ": " + JSON.stringify(request) + "\n");
    }

    if (request.recipient !== 'popup')
        return;

    if (request.do && request.do === 'queue size update') {

        function listenForCancelClick() {
            chrome.runtime.sendMessage({recipient: 'background', do: 'stop downloads'});
        }

        if (request.size > 0) {
            cancelBtn.innerText = `Cancel ${request.size}`;
            cancelBtn.disabled = false;
            cancelBtn.addEventListener("click", listenForCancelClick);
        } else {
            // If previous state was 1 download left then we are done now :)
            if (cancelBtn.innerText === 'Cancel 1')
                status.innerText = 'Done :)';

            cancelBtn.innerText = 'Cancel';
            cancelBtn.disabled = true;
            try { cancelBtn.removeEventListener(listenForCancelClick); } catch (e) {}
        }

        return;
    }

    let token = request.token;
    let serverUrl = request.serverUrl;
    let detailsPath = request.detailsPath;

    let xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) // 4 is finished, all other states are irrelevant as of now.
            return;

        if (xhr.status === 200) { // Success

            let data = JSON.parse(xhr.responseText);
            let album = data.MediaContainer;
            let elements = album.Metadata;

            let path = 'Plex downloads/';
            if (album.playlistType && album.playlistType === 'photo')
                path += escapeWinDir(album.title);
            if (album.viewGroup)
                path += `${escapeWinDir(album.title1)}/${escapeWinDir(album.title2)}`;

            let elementUrls = [];
            elements.forEach(function (element) {
                elementUrls.push({
                    url: [serverUrl, element.Media[0].Part[0].key, "?X-Plex-Token=", token, "&download=1"].join(""),
                    path: path,
                    filename: escapeWinDir(element.title + "." + element.Media[0].container)
                })
            });

            status.innerText = `Found ${elementUrls.length} elements to download.`;
            downloadBtn.disabled = false;
            downloadBtn.addEventListener("click", function () {
                status.innerText = `Added ${elementUrls.length} elements to queue.`;

                downloadBtn.removeEventListener("click", this);
                downloadBtn.disabled = true;

                chrome.runtime.sendMessage({recipient: 'background', do: 'add to queue', items: elementUrls});
            });
        } else if (xhr.status === 401) { // Auth error
            status.innerText = "Authorization error."
        } else if (xhr.status !== 200) { // Generic error
            status.innerText = "Error while fetching album contents.\nReopen this popup to try again.";
        }

    };

    status.innerText = "Requesting album info from server...";
    let requestUrl = [serverUrl, detailsPath, "?X-Plex-Token=", token].join("");
    xhr.open("GET", requestUrl, true);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.send();
});

chrome.runtime.sendMessage({recipient: 'background', do: 'get queue size'});

status.innerText = "Getting server info...";
chrome.tabs.executeScript({
    file: 'content/getServerInfo.js'
});