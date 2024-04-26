/// OTS data handling utility functions ///

const LID_GATEWAY =200
const LID_CONSOLE=260
const LID_CONFIG=281
const LID_SLOWCONTROLS=282
const LID_MACROMAKER=000

// Need to make this page specific
getAppStatusEnabled =true;
getCurrentStateEnabled = true;
getAliasListEnabled = true;



// Main XmlHttpRequest get call
function get(RequestType, data="", lid=200, type1="Request") {
    let base_url = window.location.origin;
    if(lid === LID_SLOWCONTROLS) {
        base_url = window.location.protocol+"//"+
                   window.location.hostname+":"+
                   (parseInt(window.location.port, 10)+1).toString()
    }
    let url = base_url +
              '/urn:xdaq-application:lid=' + 
              lid.toString();
    // Default reqeusts all go to /Request
    // overwrite here for special cases
    switch(type1) {
        case 'transition':
            url += '/StateMachineXgiHandler?StateMachine=' +
            RequestType;
            break;

        default:
            url += '/Request?RequestType=' +
            RequestType;
    }

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
                    if(childObj.hasOwnProperty('value') && 
                       ((childNode.nodeName != "messages") //&&             // exceptions to keep value for messages
                        )) {     
                        if(childObj.value === '') {
                            childObj = " "
                        } else {
                            if(Object.keys(childObj).length > 1) {
                                name_ = childObj.value;
                                delete childObj.value;
                                let newChildObj = {}
                                newChildObj[name_] = childObj
                                childObj = newChildObj;
                            } else {
                                childObj = childObj.value
                            }
                        }
                    }
                    const childName = childNode.nodeName;
                    //console.log("DEBUG", childName, childObj)

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
///////////////////////////////// Some utility functions //////////////////////////////////
function formatTime(seconds, noHours=false) { // from gemini
    const date = new Date(seconds * 1000); 
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const secs = date.getSeconds(); 
    const formattedHours = hours.toString().padStart(2, '0'); 
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = secs.toString().padStart(2, '0'); 
    if(noHours) return `${formattedMinutes}:${formattedSeconds}`;
    else return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}


///////////////////////////////////////////////////////////////////////////////////////////
////////////////////////// OTS API - OTS communciation functions //////////////////////////

async function getAppStatus() {
    try { const xml = await get('getAppStatus', lid=LID_GATEWAY);
        return neastJson(xmlToJson(xml).DATA, "name");
    } catch (error) { console.error("Error:", error); }
}

async function restartContext(context) {
    try { const xml = await get("restartApps&contextName="+context, lid=LID_GATEWAY);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

async function getAliasList() {
    try { const xml = await get('getAliasList', lid=LID_GATEWAY);
        return neastJson(xmlToJson(xml).DATA, "config_alias", group="aliases");
    } catch (error) { console.error("Error:", error); }
}


// Returns all contexts, no inforamtion about active or not
async function getContextMemberNames() {
    try { const xml = await get('getContextMemberNames', lid=LID_GATEWAY);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

async function getSystemMessages() {
    try { const xml = await get('getSystemMessages', lid=LID_GATEWAY);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

// Returns the different states and possible transitions
async function getStateMachine() {
    try { const xml = await get('getStateMachine', lid=LID_GATEWAY);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

// transition the state machine
async function transition(state, config="crv_vst_config"){ //}, name="OtherRuns0") {
    console.log("transition", state)
    try { const xml = await get(state, //+"?fsmName="+name,
        data="ConfigurationAlias="+config, 
        lid=LID_GATEWAY, type1="transition");
        let json = xmlToJson(xml).DATA;
        if(json['state_tranisition_attempted'] != "1") {
            throw(json['state_tranisition_attempted_err']);
        }
        return json;
    } catch (error) { console.error("Error:", error); }
}

// Returns the names of all avaiable state machines
// not yet sure where this is used
async function getStateMachineNames() {
    try { const xml = await get('getStateMachineNames', lid=LID_GATEWAY);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

async function getCurrentState() {
    try { const xml = await get('getCurrentState', lid=LID_GATEWAY);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}


// lcount: last count?
async function getConsoleMsgs(lcount=0) {
    try { const xml = await get('GetConsoleMsgs', 
        data="lcount="+lcount.toString(), lid=LID_CONSOLE);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

// Slow Controls
async function getSlowPages(lcount=0) {
    try { const xml = await get('GetPages', 
        data="lcount="+lcount.toString(), lid=LID_SLOWCONTROLS);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

// Get the settings of PVS in a list 
async function getPVSettings(pvlist=[]) {
    try { const xml = await get('getPVSettings', 
        data="pvList="+pvlist.join(",")+",", lid=LID_SLOWCONTROLS);
        //console.log(xml);
        return JSON.parse(xmlToJson(xml).DATA.JSON);
    } catch (error) { console.error("Error:", error); }
}

async function getPVList() {
    try { const xml = await get('getList', 
        data="",lid= LID_SLOWCONTROLS);
        //console.log(xml);
        return JSON.parse(xmlToJson(xml).DATA.JSON);
    } catch (error) { console.error("Error:", error); }
}

// generate a uid associated with a list of PVs,
// this uid is used to poll the data
async function getPollUid(pvlist=[]) {
    try { const xml = await get("generateUID", 
    data="pvList="+pvlist.join(",")+",", lid=LID_SLOWCONTROLS);
        return JSON.parse(xmlToJson(xml).DATA.JSON);
    } catch (error) { console.error("Error:", error); }
}

// needs uid from the function above to poll the data
async function pollPV(uid) {
    try { const xml = await get("poll&uid="+uid.toString(), 
        data="", lid=LID_SLOWCONTROLS);
        return JSON.parse(xmlToJson(xml).DATA.JSON);
    } catch (error) { console.error("Error:", error); }
}

// same as poll but takes a pvlist instead of uid
async function getPvData(pvlist=[]) {
    console.log("test")
    try { const xml = await get("getPvData", 
    data="pvList="+pvlist.join(",")+",", lid=LID_SLOWCONTROLS);
    console.log(xml);
        return JSON.parse(xmlToJson(xml).DATA.JSON);
    } catch (error) { console.error("Error:", error); }
}

// if no pvlist is given, get all alarms
async function getLastAlarmsData(pvlist=[]) {
    try { 
        data="pvList="+pvlist.join(",")+","
        const xml = await get("getLastAlarmsData", 
        data="", lid=LID_SLOWCONTROLS);
        console.log(xml);
        return JSON.parse(xmlToJson(xml).DATA.JSON);
    } catch (error) { console.error("Error:", error); }
}

// these exposes the internal alarm checks of the slow controls dashboard to the user
async function getAlarmChecks() {
    try { 
        const xml = await get("getAlarmsCheck", 
        data="", lid=LID_SLOWCONTROLS);
        console.log(xml);
        return JSON.parse(xmlToJson(xml).DATA.JSON);
    } catch (error) { console.error("Error:", error); }
}

async function getTreeView() {
    try { 
        const xml = await get("getTreeView&depth=15", 
        data="startPath=//XDAQContextTable/CRV08FEContext", lid=LID_CONFIG);
        return xmlToJson(xml).DATA['tree'];
    } catch (error) { console.error("Error:", error); }
}

async function getHardwareTree(context=null) {
    try { 
        if(context) {
            const xml = await get("getTreeView&depth=15", 
            data="startPath=//XDAQContextTable/"+context, lid=LID_CONFIG);
            //var tree = xml.getElementsByTagName("ROOT")[0].getElementsByTagName("DATA")[0].getElementsByTagName("tree")[0]
            let hardware = {};
            let dtcs = xml.querySelectorAll("[value='LinkToFEInterfaceTable']>node");
            dtcs.forEach(dtc => {
                const dtcName = dtc.getAttribute("value")
                const dtcStatus = dtc.querySelector("[value='Status']>value").getAttribute("value")
                const dtcIndex  = dtc.querySelector("[value='DeviceIndex']>value").getAttribute("value")
                const dtcId     = dtc.querySelector("[value='EventBuilderDTCID']>value").getAttribute("value")
                hardware[dtcName] = {"status": dtcStatus, 
                                     "index": dtcIndex,
                                     "id" : dtcId,
                                     "rocs" : {}};
                let rocs = dtc.querySelectorAll("[value='LinkToROCGroupTable']>node");
                rocs.forEach(roc => {
                    const rocName =   roc.getAttribute("value")
                    const rocStatus = roc.querySelector("[value='Status']>value").getAttribute("value")
                    const rocId  =    roc.querySelector("[value='linkID']>value").getAttribute("value")
                    hardware[dtcName]["rocs"][rocName] = {"status": rocStatus, 
                                                          "linkId": rocId,
                                                          "febs" : {}}
                    let febs = dtc.querySelectorAll("[value='LinkToFEBInterfaceTable']>node");
                    febs.forEach(feb => {
                        const febName =   feb.getAttribute("value")
                        const febStatus = feb.querySelector("[value='Status']>value").getAttribute("value")
                        console.log(feb)
                        const febPort  =  feb.querySelector("[value='Port']>value").getAttribute("value")
                        hardware[dtcName]["rocs"][rocName]["febs"][febName] = {"status":febStatus,
                                                                               "port":febPort}
                    });
                });

            });
            return hardware;
        } else {
            hardware = {};
            let context = "CRV08FEContext";
            const hw = await getHardwareTree(context=context);
            hardware[context] = hw;
            return hardware;
            //const contexts = getContextMemberNames()['ContextMember'];
            //contexts.forEach(context => {
            //    
            //})
        }
    } catch (error) { console.error("Error:", error); }
}


function mu2e_init(name) {
    document.title = "Mu2e :: "+name
    fetchData();
    updateAliasList(); // don't update regularly
    updateAppStatus();
    setInterval(fetchData, 1000);
    // start 

}

function setStatusColor(el, className) {
    el.classList.remove("mu2e_bad")
    el.classList.remove("mu2e_ok")
    el.classList.remove("mu2e_warning")
    el.classList.remove("mu2e_transition")
    if(className)
        el.classList.add(className)
}

async function fetchData() {
    //clearMessages()

    // send all enabled fetch requests
    if(getAppStatusEnabled) handleAppStatus();
    if(getCurrentStateEnabled) handleCurrentState();
    //if(getAliasListEnabled) handleAliasList();
}

async function updateAppStatus(includeApps=false) {
    let div = document.getElementById("mu2e_apps");
    div.replaceChildren()
    
    const title = document.createElement("div")
    title.classList.add("mu2e_title")
    title.style.cssText = "grid-column: 1/"+(includeApps ? "6" : "5")+"; grid-row: 1";

    title.textContent = "XDAQ"
    let span = document.createElement("span")
    span.classList.add("mu2e_right_float");
    let refresh = document.createElement("a")
    refresh.href = "#";
    refresh.alt = "Refresh";
    refresh.style.cssText = "text-decoration:none; padding:3px; color:white;"
    refresh.addEventListener("click",  function (e) { updateAppStatus(includeApps);});
    refresh.innerHTML = "&#x21bb";
    let toggle = document.createElement("a")
    toggle.href = "#";
    toggle.style.cssText = "text-decoration:none; padding:3px; color:white;"
    toggle.addEventListener("click",  function (e) { updateAppStatus(!includeApps);});
    if(includeApps) {
        toggle.alt = "remove Apps";
        toggle.innerHTML = "-";
    } else {
        toggle.alt = "add Apps";
        toggle.innerHTML = "+";
    }

    //span.appendChild(refresh)
    span.appendChild(toggle)
    title.appendChild(span)
    div.appendChild(title)

    let res = await getAppStatus();
    // get all contexts
    let contexts = {}
    for (const appName in res) {
        const context_ = res[appName]['context'];
        if(!(context_ in contexts)) {
            contexts[context_] = {"url": res[appName]["url"], "apps":[]}
        }
    }

    let index = 3;
    Object.entries(contexts).forEach(([context, cdata]) => {
        //let row = document.createElement("div");
        let row_start = index;

        Object.keys(res).forEach(appN => {
            const app = res[appN];
            if(app['context'] == context) {
                contexts[context]['apps'].push(appN)
                let colindex = 3;
                if(includeApps) {
                    appName = document.createElement("div");
                    appName.style.cssText = "grid-column: "+(colindex++).toString()+"; grid-row:"+(index).toString()+";";
                    appName.classList.add("mu2e_list")
                    appName.innerHTML = appN
                    div.appendChild(appName);
                }
                appStatus = document.createElement("div");
                appStatus.style.cssText = "grid-column: "+(colindex++).toString()+"; grid-row:"+(index).toString()+";";
                appStatus.setAttribute("name", "mu2e_"+appN+"_state")
                appStatus.classList.add("mu2e_data")
                appStatus.innerHTML = app['status']
                if(includeApps || contexts[context]['apps'].length == 1) {
                    div.appendChild(appStatus);
                }
                appTime = document.createElement("div");
                appTime.style.cssText = "grid-column: "+(colindex++).toString()+"; grid-row:"+(index).toString()+";";
                appTime.setAttribute("name", "mu2e_"+appN+"_state_time")
                appTime.classList.add("mu2e_data")
                appTime.innerHTML = formatTime(Number(app['stale']), noHours=true);
                if(includeApps || contexts[context]['apps'].length == 1) {
                    div.appendChild(appTime);
                }
                //if(contexts[context]['apps'].length > 1) {
                //    appTime.classList.add("group_"+context)
                //    appTime.classList.add("mu2e_hidden")
                //}
                //appDetails = document.createElement("div");
                //appDetails.style.cssText = "grid-column: 5; grid-row:"+(index).toString()+";";
                //appDetails.setAttribute("name", "mu2e_"+appN+"_details")
                //appDetails.classList.add("mu2e_data")
                //appDetails.innerHTML = app['detail'];
                //div.appendChild(appDetails);
                if(includeApps || contexts[context]['apps'].length == 1) {
                    index = index + 1;
                }
            }

        });
        let contextName = document.createElement("div");
        contextName.style.cssText = "grid-column: 1; grid-row:"+(row_start).toString()+"/"+(index).toString()+";";
        contextName.classList.add("mu2e_list")
        contextName.innerHTML = context; //&#x21bb;
        div.appendChild(contextName);
        let contextHost = document.createElement("div");
        contextHost.style.cssText = "grid-column: 2; grid-row:"+(row_start).toString()+"/"+(index).toString()+";";
        contextHost.classList.add("mu2e_list")
        const hostUrl = new URL(contexts[context]['url']);
        const hostName = hostUrl.hostname.split(".")[0] + ":"+hostUrl.port
        contextHost.innerHTML = hostName+"<span class=\"mu2e_right_float\"><a href=\"#\" style=\"text-decoration:none;\" alt=\"Restart\" onClick='restartContext(\""+context+"\")'>&#x2622;</a></span>"; //&#x21bb;
        div.appendChild(contextHost);

    });
    
}

async function handleAppStatus() {
        let res = await getAppStatus();
        //console.log(res)

        // update all mu2e_NAME_status and mu2e_NAME_status_time elements
        Object.keys(res).forEach(appName => {
            const selector = 'div[name="mu2e_'+appName+'_state"]'
            const selectorTime = 'div[name="mu2e_'+appName+'_state_time"]'
            const status = res[appName]['status'].split(":::")
            document.querySelectorAll(selector).forEach(div => {
                let status_ = status[0];
                let progress = res[appName]['progress'];
                if(progress != "100") {
                    status_ += " - "+progress+"%"
                }
                div.innerHTML = status_;
                if((status[0] == "Running") || (status[0] == "Configured") || (status[0] == "Configuring")) {
                    setStatusColor(div, "mu2e_ok");
                } else if((status[0] == "Halted") || (status[0] == "Initial")) {
                    setStatusColor(div, "mu2e_warning");
                } else {
                    setStatusColor(div, "mu2e_bad");
                }
                if(status.length>1) { // additional error message avaiable
                    const newSpan = document.createElement('span');
                    newSpan.innerHTML = status.join(":::");
                    newSpan.className = "tooltiptext"
                    div.appendChild(newSpan);
                }
            });
            time = res[appName]['stale']
            document.querySelectorAll(selectorTime).forEach(div => {
                div.innerHTML = formatTime(Number(time), noHours=true);
                if(Number(time)>10) {
                    setStatusColor(div, "mu2e_bad");
                } else {
                    setStatusColor(div, null);
                }
                if(status.length>1) { // additional error message avaiable
                    const newSpan = document.createElement('span');
                    newSpan.innerHTML = status.join(":::");
                    newSpan.className = "tooltiptext"
                    div.appendChild(newSpan);
                }
            });
        });

        //// set the status in the header
        if('GatewaySupervisor' in res) {
            let status = res['GatewaySupervisor']['status'].split(":::")
        //    document.querySelectorAll('div[name="mu2e_state"]').forEach(div => {
        //        let status_ = status[0];
        //        let progress = res['GatewaySupervisor']['progress'];
        //        if(progress != "100") {
        //            status_ += " - "+progress+"%"
        //        }
        //        div.innerHTML = status_;
        //        if((status[0] == "Running") || (status[0] == "Configured")) {
        //            setStatusColor(div, "mu2e_ok");
        //        } else if((status[0] == "Halted") || (status[0] == "Init")) {
        //            setStatusColor(div, "mu2e_warning");
        //        } else {
        //            setStatusColor(div, "mu2e_bad");
        //        }
        //        if(status.length>1) { // additional error message avaiable
        //            const newSpan = document.createElement('span');
        //            newSpan.innerHTML = status.join(":::");
        //            newSpan.className = "tooltiptext"
        //            div.appendChild(newSpan);
        //        }
        //    });
            // adjust run transition buttons accordingly
            document.querySelectorAll('div[name="mu2e_transition"]').forEach(div => {
                let oldButton = div.querySelector('button')
                let button = document.createElement("button")
                let updated = false;
                console.log(status[0])
                switch(status[0]) {
                    case "Configured":
                        if(oldButton == null || oldButton.innerHTML !== "Start") {
                            button.innerHTML = "Start"
                            button.addEventListener("click", function (e) { 
                                try { transition("Start"); }
                                catch(error) {
                                    const newSpan = document.createElement('span');
                                    newSpan.innerHTML = error;
                                    newSpan.className = "tooltiptext"
                                    div.appendChild(newSpan);
                                };
                            });
                            button.disabled = false;
                            updated = true;
                        }
                        break;
                    case "Halted":
                        if(oldButton == null || oldButton.innerHTML !== "Configure") {
                            button = button.cloneNode(false);
                            button.innerHTML = "Configure"
                            button.addEventListener("click", function (e) {transition('Configure');});
                            button.disabled = false;
                            updated = true;
                        }
                        break;
                    case "Running":
                        if(oldButton == null || oldButton.innerHTML !== "Stop") {
                            button = button.cloneNode(false);
                            button.innerHTML = "Stop"
                            button.addEventListener("click", function (e) {transition('Configure');});
                            button.disabled = false;
                            updated = true;
                        }
                        break;    
                    case "Failed":
                    case "Initial":
                        if(oldButton == null || oldButton.innerHTML !== "Halt") {
                            button = button.cloneNode(false);
                            button.innerHTML = "Halt"
                            button.addEventListener("click", function (e) {transition('Halt');});
                            button.disabled = false;
                            updated = true;
                        }
                            break;    
                    default:
                        if(oldButton != null) {
                            oldButton.disabled = true;
                        }
                }
                if(updated) {
                    if(oldButton) div.replaceChild(button, oldButton);
                    else div.appendChild(button)
                }

            });

            if(res['GatewaySupervisor']['progress'] != '100') {
                let stale_ = res['GatewaySupervisor']['stale'];
                document.querySelectorAll('div[name="mu2e_state_time"]').forEach(div => {
                    if(stale_) {
                        if(Number(stale_,10) > 3) div.innerHTML = "In transition, stale for "+formatTime(Number(stale_,10));
                        else                      div.innerHTML = "In transition";
                    } else                        div.innerHTML = "In transition";
                });
            }
        } else {
            reportError("'GatewaySupervisor' not found." );
        }

        // modify the app status table
        //res.forEach(app =>{
        //    console.log(app)
        //});
}

async function handleCurrentState() {
    let res = await getCurrentState();
    let time_ = res['time_in_state'];
    let in_transition_ = res['in_transition'];
    document.querySelectorAll('div[name="mu2e_state_time"]').forEach(div => {
        if(in_transition_ == 0) {
            if(time_) {
                div.innerHTML = "Time in state: "+formatTime(Number(time_,10));
            } else {
                div.innerHTML = "Time in state: XX:XX:XX";
            }
        } else {
            //div.innerHTML = "In transition", lets handle this by getAppStatus where we also have the stale time
        }
    });
}

var aliasList = [];
async function updateAliasList() {
    let res = await getAliasList();
    aliasList = Object.keys(res['aliases'])
    let config_ = res['UserLastConfigAlias'];
    document.querySelectorAll('div[name="mu2e_last_config"]').forEach(div => {
        if(config_) {
            div.innerHTML = "OTS config: "+config_;
        } else {
            div.innerHTML = "OTS config: ";
        }
    });
}

function reportError(msg) {
    console.log(msg)
}

function clearMessages() {
    document.querySelector("#messages").innerHTML = ""
}

function addMessage(msg) {
    let message = document.querySelector("#messages")
    const newSpan = document.createElement('span');
    newSpan.innerHTML = msg
    message.appendChild(newSpan);
}

