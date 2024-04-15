/// OTS data handling utility functions ///

const LID_GATEWAY =200
const LID_CONSOLE=260
const LID_SLOWCONTROLS=282
const LID_MACROMAKER=000

// Main XmlHttpRequest call
function get(RequestType, data="", lid=200) {
    let base_url = window.location.origin;
    if(lid === LID_SLOWCONTROLS) {
        base_url = window.location.protocol+"//"+
                   window.location.hostname+":"+
                   (parseInt(window.location.port, 10)+1).toString()
    }
    let url = base_url +
              '/urn:xdaq-application:lid=' + 
              lid.toString()+'/Request?RequestType=' +
              RequestType;
    return fetch(url, {method: 'POST', body: data})
       .then(response => {
        if (!response.ok) {
            throw new Error(`Network response error: ${response.status}`);
        }
        return response.text();
        })
        .then(xmlString => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "text/xml");
            return xmlDoc.querySelector('ROOT'); // Return the parsed XML document
        })
        .catch(error => {
            console.error('Error fetching status:', error);
        });
}

// Parse an xml document recursively into an javascript object (json) that is much eaiser to handle down the line
// If the same attribute are present multiple time, they are converted to a list.
// If tryToNeastBy is not None (but for example "name"), the function tries to generat an object neasted by that attribute
function xmlToJson(xmlNode) {
    if (xmlNode.nodeType === Node.ELEMENT_NODE) {
        const obj = {};
        // Handle attributes
        if (xmlNode.hasAttributes()) {
            for (let i = 0; i < xmlNode.attributes.length; i++) {
                const attr = xmlNode.attributes[i];
                obj[attr.name] = attr.value;
            }
        }

        // Handle children
        if (xmlNode.hasChildNodes()) {
            for (let i = 0; i < xmlNode.childNodes.length; i++) {
                const childNode = xmlNode.childNodes[i];

                // Ignore text nodes and comments
                if (childNode.nodeType === Node.ELEMENT_NODE) {
                    childObj = xmlToJson(childNode);
                    if(childObj.hasOwnProperty('value') && childNode.nodeName != "messages") {
                        if(childObj.value === '') {
                            childObj = " "
                        } else {
                             childObj = childObj.value
                        }
                    }
                    const childName = childNode.nodeName;

                    // Handle multiple children with the same name
                    if (obj[childName]) {
                        // Already exists, convert to array
                        if (!Array.isArray(obj[childName])) {
                            obj[childName] = [obj[childName]]; 
                        }
                        obj[childName].push(childObj); 
                    } else {
                        obj[childName] = childObj; 
                    }
                }
            }
        }

        return obj;
    }
}

// Some of the OTS xml data is not neasted, neasting them will make data handling easier downstream
function neastJson(oldObj, attribute="name", group=null) {
    if(oldObj.hasOwnProperty(attribute)) {
        let newObj = {}
        if(group) { 
            newObj[group] = {}
            ptObj = newObj[group];
        } else {
            ptObj = newObj;
        }
        for (let i = 0; i < oldObj[attribute].length; i++) {
            const name = oldObj[attribute][i]
            ptObj[name] = {}
            //loop over all other attributes
            for (const property in oldObj) {
                if (property !== attribute) {
                    if (oldObj[property].length === oldObj[attribute].length) {
                        ptObj[name][property] = oldObj[property][i];
                    } else {
                        newObj[property] = oldObj[property]
                    }
                }
            }
        }
        return newObj;
    } else {
        return oldObj;
    }
}


///////////////////////////////////////////////////////////////////////////////////////////
////////////////////////// OTS API - OTS communciation functions //////////////////////////

async function getAppStatus() {
    try { const xml = await get('getAppStatus', LID_GATEWAY);
        return neastJson(xmlToJson(xml).DATA, "name");
    } catch (error) { console.error("Error:", error); }
}

async function getAliasList() {
    try { const xml = await get('getAliasList', LID_GATEWAY);
        return neastJson(xmlToJson(xml).DATA, "config_alias", group="aliases");
    } catch (error) { console.error("Error:", error); }
}


// Returns all contexts, no inforamtion about active or not
async function getContextMemberNames() {
    try { const xml = await get('getContextMemberNames', LID_GATEWAY);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

async function getSystemMessages() {
    try { const xml = await get('getSystemMessages', LID_GATEWAY);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

// Returns the different states?
// C, F, H, I, P, R, X
async function getStateMachine() {
    try { const xml = await get('getStateMachine', LID_GATEWAY);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

// Returns the names of all avaiable state machines
// not yet sure where this is used
async function getStateMachineNames() {
    try { const xml = await get('getStateMachineNames', LID_GATEWAY);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

async function getCurrentState() {
    try { const xml = await get('getCurrentState', LID_GATEWAY);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}


// lcount: last count?
async function getConsoleMsgs(lcount=0) {
    try { const xml = await get('GetConsoleMsgs', 
        data="lcount="+lcount.toString(), LID_CONSOLE);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

// Slow Controls
async function getSlowPages(lcount=0) {
    try { const xml = await get('GetPages', 
        data="lcount="+lcount.toString(), LID_SLOWCONTROLS);
        console.log(xml);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

// Get the settings of PVS in a list 
async function getPVSettings(pvlist=[]) {
    try { const xml = await get('getPVSettings', 
        data="pvList="+pvlist.join(",")+",", LID_SLOWCONTROLS);
        //console.log(xml);
        return JSON.parse(xmlToJson(xml).DATA.JSON);
    } catch (error) { console.error("Error:", error); }
}

async function getPVList() {
    try { const xml = await get('getList', 
        data="", LID_SLOWCONTROLS);
        //console.log(xml);
        return JSON.parse(xmlToJson(xml).DATA.JSON);
    } catch (error) { console.error("Error:", error); }
}

// generate a uid associated with a list of PVs,
// this uid is used to poll the data
async function getPollUid(pvlist=[]) {
    try { const xml = await get("generateUID", 
    data="pvList="+pvlist.join(",")+",", LID_SLOWCONTROLS);
        return JSON.parse(xmlToJson(xml).DATA.JSON);
    } catch (error) { console.error("Error:", error); }
}

// needs uid from the function above to poll the data
async function pollPV(uid) {
    try { const xml = await get("poll&uid="+uid.toString(), 
        data="", LID_SLOWCONTROLS);
        return JSON.parse(xmlToJson(xml).DATA.JSON);
    } catch (error) { console.error("Error:", error); }
}

// same as poll but takes a pvlist instead of uid
async function getPvData(pvlist=[]) {
    console.log("test")
    try { const xml = await get("getPvData", 
    data="pvList="+pvlist.join(",")+",", LID_SLOWCONTROLS);
    console.log(xml);
        return JSON.parse(xmlToJson(xml).DATA.JSON);
    } catch (error) { console.error("Error:", error); }
}

// if no pvlist is given, get all alarms
async function getLastAlarmsData(pvlist=[]) {
    try { 
        data="pvList="+pvlist.join(",")+","
        const xml = await get("getLastAlarmsData", 
        data="", LID_SLOWCONTROLS);
        console.log(xml);
        return JSON.parse(xmlToJson(xml).DATA.JSON);
    } catch (error) { console.error("Error:", error); }
}

// these exposes the internal alarm checks of the slow controls dashboard to the user
async function getAlarmChecks() {
    try { 
        const xml = await get("getAlarmsCheck", 
        data="", LID_SLOWCONTROLS);
        console.log(xml);
        return JSON.parse(xmlToJson(xml).DATA.JSON);
    } catch (error) { console.error("Error:", error); }
}



