// identify server that hosts the current album
machineID = window.location.href.match(/(?<=\/server\/)\w+/g)[0];
user = JSON.parse(window.localStorage.users).users.filter(user => typeof user.authToken !== 'undefined')[0];
server = user.servers.filter(server => server.machineIdentifier === machineID)[0];

// access token to the relevant server (may be the same as plex token if it's own server)
token = typeof server.accessToken !== 'undefined' ? server.accessToken : user.authToken;

// general url for the server that hosts the current album
serverUrl = server.connections[0].uri;

// get path for details lookup
urlParamPart = window.location.href.split("?")[1];
params = new Map();

urlParamPart.split("&").forEach(function (part) {
    params.set(part.split("=")[0], part.split("=")[1])
});

// the path to use to lookup info like download path etc.
detailsPath = decodeURIComponent(params.get("key"));
if (detailsPath.includes("library/metadata"))
    detailsPath += "/children";
else if (detailsPath.includes("playlists"))
    detailsPath += "/items";

// return info to extension popup script
chrome.runtime.sendMessage({recipient: 'popup', token: token, serverUrl: serverUrl, detailsPath: detailsPath});