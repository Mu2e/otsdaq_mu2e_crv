/// OTS data handling utility functions ///

const LID_GATEWAY =200
const LID_CONSOLE=260
const LID_CONFIG=281
const LID_SLOWCONTROLS=282
const LID_MACROMAKER=800

// Need to make this page specific
getAppStatusEnabled =true;
getCurrentStateEnabled = true;
getAliasListEnabled = true;
getAlarmChecksEnabled = true;
getSystemMessagesEnabled = true;

DCS_PREFIX = "Mu2e:TDAQ_crv"



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
            return undefined;
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

function addTime(div, time, dtime=0) {
    let span = div.querySelector("span")
    if(span == undefined) {
        span = document.createElement("span")
        span.classList.add("mu2e_right_float");
        span.classList.add("mu2e_dcs_timestamp");
        div.appendChild(span)
    }
    if(dtime > 120) {
        setStatusColor(span, "mu2e_bad_text")
    }
    span.innerHTML = time.toLocaleTimeString(['en-GB'], {hour: '2-digit', minute: '2-digit', second: '2-digit' })
    //span.innerHTML = formatTime(dtime)
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

async function getSystemMessages(history = false) {
    try { 
        data = history ?  "history=true" : "";
        const xml = await get('getSystemMessages', 
        data=data, lid=LID_GATEWAY);
        let json = xmlToJson(xml).DATA
        let parts = decodeURIComponent(json["systemMessages"]).split("|");
        out = []
        if(parts.length>1) {
            for(let i = 0; i < parts.length/2; i++) {
                out.push({"time":parts[i*2],
                        "message":parts[i*2+1]
                        })
            }
            decodeURI(json["systemMessages"]).split("|").forEach
            json["systemMessages"] = out
        } else {
            json["systemMessages"] = []
        }
        return json;
    } catch (error) { console.error("Error:", error); }
}

// Returns the different states and possible transitions
async function getStateMachine() {
    try { const xml = await get('getStateMachine', lid=LID_GATEWAY);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

async function getRunInfo(run=0) {
    try { const xml = await get("getRunInfo&RunNumber="+run.toString(), 
          lid=LID_GATEWAY);
          let out = xmlToJson(xml).DATA;
          console.log(out["plugin"])
          if(out["plugin"]) {
            out["plugin"] = JSON.parse(out["plugin"])
          }
        return out
    } catch (error) { console.error("Error:", error); }
}

// transition the state machine
async function transition(state, config="crv_vst_config", name="OtherRuns0") {
    try { const xml = await get(state+"&fsmName="+name,
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
    try { const xml = await get("getPvData", 
        data="pvList="+pvlist.join(",")+",", lid=LID_SLOWCONTROLS);
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
        if(xml) return JSON.parse(xmlToJson(xml).DATA.JSON);
        else return undefined;
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

async function dtcRead(reg, dtc="daq08DTC") {
    try { 
        const xml = await get("runFEMacro&feClassSelected=DTCFrontEndInterface&feUIDSelected="+dtc+"&macroType=fe&macroName=DTC%20Read&saveOutputs=0", 
        data="inputArgs=address,"+reg+"&outputArgs=readData", lid=LID_MACROMAKER);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

async function dtcWrite(reg, val, dtc="daq08DTC") {
    try { 
        const xml = await get("runFEMacro&feClassSelected=DTCFrontEndInterface&feUIDSelected="+dtc+"&macroType=fe&macroName=DTC%20Write&saveOutputs=0", 
        data="inputArgs=address,"+reg+";writeData,"+val+"&outputArgs=Status", 
        lid=LID_MACROMAKER);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

async function rocRead(reg, dtc="daq08DTC", link=0) {
    try { 
        const xml = await get("runFEMacro&feClassSelected=DTCFrontEndInterface&feUIDSelected="+dtc+"&macroType=fe&macroName=ROC%20Read&saveOutputs=0", 
        data="inputArgs=rocLinkIndex,"+link.toString()+";address,"+reg+"&outputArgs=readData", lid=LID_MACROMAKER);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

async function rocWrite(reg, val, dtc="daq08DTC", link=0) {
    try { 
        const xml = await get("runFEMacro&feClassSelected=DTCFrontEndInterface&feUIDSelected="+dtc+"&macroType=fe&macroName=ROC%20Write&saveOutputs=0", 
        data="inputArgs=rocLinkIndex,"+parseInt(link).toString()+";address,"+reg+";writeData,"+val+"&outputArgs=", 
        lid=LID_MACROMAKER);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

async function dtcReset(hard=false, dtc="daq08DTC") {
    try { 
        const macroName = hard ? "DTC%20Hard%20Reset" : "DTC%20Soft%20Reset"
        const xml = await get("runFEMacro&feClassSelected=DTCFrontEndInterface&feUIDSelected="+dtc+"&macroType=fe&macroName="+macroName+"&saveOutputs=0", 
        data="inputArgs=&outputArgs=", 
        lid=LID_MACROMAKER);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

async function rocReset(dtc="daq08DTC", roc="Default") {
    try { 
        const xml = await get("runFEMacro&feClassSelected=DTCFrontEndInterface&feUIDSelected="+dtc+"&macroType=fe&macroName=ROC%20FEMacro%20-%20Reset%20uC&saveOutputs=0", 
        data="inputArgs=Target%20ROC%20(Default%20%3D%20-1%20%3A%3D%20all%20ROCs),"+roc+"&outputArgs=Target%20ROC", 
        lid=LID_MACROMAKER);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

async function rocPwrPort(dtc="daq08DTC", roc="Default", port="Default") {
    try { 
        const xml = await get("runFEMacro&feClassSelected=DTCFrontEndInterface&feUIDSelected="+dtc+"&macroType=fe&macroName=ROC%20FEMacro%20-%20PWRRST&saveOutputs=0", 
        data="inputArgs=Target%20ROC%20(Default%20%3D%20-1%20%3A%3D%20all%20ROCs),"+roc+";port%20(Default%2025%20-%20all),"+port+"&outputArgs=Target%20ROC",
        lid=LID_MACROMAKER);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

async function febCMBENA(val="1", dtc="daq08DTC", roc="Default") {
    try { 
        const xml = await get("runFEMacro&feClassSelected=DTCFrontEndInterface&feUIDSelected="+dtc+"&macroType=fe&macroName=ROC%20FEMacro%20-%20FEBs%20CMBENA&saveOutputs=0", 
        data="inputArgs=Target%20ROC%20(Default%20%3D%20-1%20%3A%3D%20all%20ROCs),"+roc+";value%20(Default%201),"+val+"&outputArgs=Target%20ROC",
        lid=LID_MACROMAKER);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

async function febSetBias(val, fpga, no,  dtc="daq08DTC", roc="Default", port="Default") {
    try { 
        const xml = await get("runFEMacro&feClassSelected=DTCFrontEndInterface&feUIDSelected="+dtc+"&macroType=fe&macroName=ROC%20FEMacro%20-%20FEB%20Set%20Bias&saveOutputs=0", 
        data="inputArgs=Target%20ROC%20(Default%20%3D%20-1%20%3A%3D%20all%20ROCs),"+roc+";port%20(Default%3A%20-1%2C%20current%20active),"+port+";fpga%20%5B0%2C1%2C2%2C3%5D,"+fpga+";number%20%5B0%2C1%5D,"+no+";bias,"+val+"&outputArgs=Target%20ROC",
        lid=LID_MACROMAKER);
        return xmlToJson(xml).DATA;
    } catch (error) { console.error("Error:", error); }
}

function mu2e_init(name) {
    document.title = "Mu2e :: "+name
    let active = name
    switch(name) {
        case "DTC":
            loadDTC();
            active = "DTC-"+_dtcName
            break;
        case "ROC":
            loadROC();
            active = "ROC-"+_rocName
            break;
        case "FEB":
                loadFEB();
                active = "FEB-"+_rocName
                break;
        case "RunLog":
                let n = new URLSearchParams(window.location.search).get('n')
                if(n == undefined) n = 20;
                loadRunLog(n);
                active = "RunLog"
                break;
        default:
    }
    fetchData();
    updateAliasList(); // don't update regularly
    addNav(); // adds main navigation entries like Overview
    updateAppStatus();
    updateHardware();
    updateAlarms();
    updateMessages();
    updateRunInfo();
    updateNav(active); // sets the active navigation entry


    loadDcsChannels(); // scans the document for <div name="mu2e_dcs" data="CHANNEL-NAME">
    setInterval(fetchData, 1000);
    // start 

}

mu2e_dcs_channels = []
function loadDcsChannels() {
    let dcs = document.querySelectorAll("div[name=\"mu2e_dcs\"]")
    for(let i = 0; i < dcs.length; i++) {
        let channel = dcs[i].getAttribute("data");
        if(channel) {
            mu2e_dcs_channels.push(channel)
        }
    }
}

var _dtcName = undefined;
function loadDTC() {
    const dtcName = new URLSearchParams(window.location.search).get('dtc')
    if(dtcName) {
        document.querySelector("div[id=\"mu2e_dtc\"]>div").textContent = "DTC - "+dtcName
    }
    document.querySelectorAll("div[name='mu2e_dcs']").forEach(div => {
        div.setAttribute("data", DCS_PREFIX+":"+dtcName+":"+div.getAttribute("data"))
    });
    _dtcName = dtcName;
}

var _rocName = undefined;
function loadROC() {
    const rocName = new URLSearchParams(window.location.search).get('roc')
    const dtcName = new URLSearchParams(window.location.search).get('dtc')
    const dtcLink = new URLSearchParams(window.location.search).get('link')
    if(rocName) {
        const div = document.querySelector("div[id=\"mu2e_roc\"]>div")
        if(div) div.textContent = "ROC - "+rocName
    }
    if((dtcName) && (dtcLink)) {
        const div_dtc = document.querySelector("#dtc")
        if(div_dtc) div_dtc.textContent = dtcName+":"+dtcLink
    }

    document.querySelectorAll("div[name='mu2e_dcs']").forEach(div => {
        div.setAttribute("data", DCS_PREFIX+":"+rocName+":"+div.getAttribute("data"))
    });
    _rocName = rocName;
}

function loadFEB() {
    //const febName = new URLSearchParams(window.location.search).get('feb')
    const rocName = new URLSearchParams(window.location.search).get('roc')
    const rocPort = new URLSearchParams(window.location.search).get('port')
    //const dtcName = new URLSearchParams(window.location.search).get('dtc')
    if(rocName) {
        const div = document.querySelector("div[id=\"mu2e_feb\"]>div")
        if(div) div.textContent = "FEB - "+rocName+" - port "+rocPort
    }
    document.querySelectorAll("div[name='mu2e_dcs']").forEach(div => {
        div.setAttribute("data", DCS_PREFIX+":"+rocName+":FEB_p"+rocPort+"_"+div.getAttribute("data"))
    });
}

function setStatusColor(el, className) {
    el.classList.remove("mu2e_bad")
    el.classList.remove("mu2e_bad_text")
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
    if(mu2e_dcs_channels.length > 0) handleEPICS();
    if(getAlarmChecksEnabled) handleAlarms();
    if(getSystemMessagesEnabled) handleMessages();
    //if(getAliasListEnabled) handleAliasList();
}

async function updateHardware() {
    let res = await getHardwareTree();

    // update navigation always when present
    let nav = document.querySelector("div[id='mu2e_nav']")
    if(nav) {
        let div_dtc = document.createElement("div")
        let div_roc = document.createElement("div")
        let span_title = document.createElement("span")
        span_title.innerHTML = "Hardware"
        div_dtc.appendChild(span_title)
        Object.keys(res).forEach(contextName => {
            Object.keys(res[contextName]).forEach(dtcName => {
                Object.keys(res[contextName][dtcName]["rocs"]).forEach(rocName => { 
                    console.log(res[contextName][dtcName]["rocs"][rocName])
                    const link = res[contextName][dtcName]["rocs"][rocName]["linkId"]
                    let a_roc = document.createElement("a")
                    a_roc.href = "Mu2eROC.html?roc="+rocName+"&dtc="+dtcName+"&link="+link.toString()
                    a_roc.innerHTML = "- "+rocName
                    a_roc.id = "ROC-"+rocName
                    if(rocName == _rocName) {
                        a_roc.classList.add("mu2e_nav_active")
                    }
                    div_roc.appendChild(a_roc)
                });
                let a_dtc = document.createElement("a")
                a_dtc.href = "Mu2eDTC.html?dtc="+dtcName
                a_dtc.innerHTML = "- "+dtcName
                a_dtc.id = "DTC-"+dtcName
                if(dtcName == _dtcName) {
                    a_dtc.classList.add("mu2e_nav_active")
                }
                div_dtc.appendChild(a_dtc)
            });
        });
        nav.appendChild(div_dtc)
        nav.appendChild(div_roc)
    }

    // if mu2e_hardware div exists, also update that
    let div = document.getElementById("mu2e_hardware");
    if(div==undefined) return;
    div.replaceChildren()

    const title = document.createElement("div")
    title.classList.add("mu2e_title")
    title.style.cssText = "grid-column: 1/5; grid-row: 1";
    title.textContent = "Hardware"
    //span.appendChild(toggle)
    //title.appendChild(span)
    div.appendChild(title)

    let row_idx = 2;
    Object.keys(res).forEach(contextName => {
        const context = res[contextName];
        c_rowidx_start = row_idx;
        Object.keys(context).forEach(dtcName => {
            const dtc = context[dtcName]; 
            const dtc_status = dtc["status"]
            const dtc_id     = dtc['id']
            d_rowidx_start = row_idx;
            Object.keys(dtc["rocs"]).forEach(rocName => {
                r_rowidx_start = row_idx;
                const roc = dtc["rocs"][rocName]; 
                let link = roc["linkId"]
                Object.keys(roc["febs"]).forEach(febName => {
                    let feb = roc["febs"][febName]
                    let f = document.createElement("div")
                    f.style.cssText = "grid-column: 4; grid-row:"+(row_idx++).toString()+";";
                    f.classList.add("mu2e_list")
                    if(feb['status'] != "On")
                        f.classList.add("mu2e_disabled")
                    let feb_a = document.createElement("a")
                    feb_a.href = "Mu2eFEB.html?roc="+rocName+"&dtc="+dtcName+"&link="+link.toString()+"&port="+feb['port'].toString()
                    feb_a.innerHTML = febName
                    f.appendChild(feb_a)
                    f.innerHTML = "port-"+feb['port'].toString() + ": " + f.innerHTML
                    div.appendChild(f);
                    let f2 = document.createElement("div")
                    f2.style.cssText = "grid-column: 4; grid-row:"+(row_idx++).toString()+";";
                    f2.classList.add("mu2e_list")
                    //if(feb['status'] != "On")
                    f2.classList.add("mu2e_disabled")
                    f2.innerHTML = "port-"+feb['port'].toString() + ": " + febName + " TEST"
                    div.appendChild(f2);
                });
                let r = document.createElement("div")
                r.style.cssText = "grid-column: 3; grid-row:"+(r_rowidx_start).toString()+"/"+(row_idx).toString()+";";
                r.classList.add("mu2e_list")
                let a = document.createElement("a")
                a.href = "Mu2eROC.html?roc="+rocName+"&dtc="+dtcName+"&link="+link.toString()
                a.innerHTML = rocName
                r.appendChild(a)
                r.innerHTML = "link-"+roc["linkId"]+": " + r.innerHTML
                div.appendChild(r);
            });
            let d = document.createElement("div")
            d.style.cssText = "grid-column: 2; grid-row:"+(d_rowidx_start).toString()+"/"+(row_idx).toString()+";";
            d.classList.add("mu2e_list")
            let a = document.createElement("a")
            a.href = "Mu2eDTC.html?dtc="+dtcName
            a.innerHTML = dtcName
            d.appendChild(a)
            d.innerHTML += " (id: "+dtc["id"]+")"
            div.appendChild(d);
        });
        let c = document.createElement("div")
        c.style.cssText = "grid-column: 1; grid-row:"+(c_rowidx_start).toString()+"/"+(row_idx).toString()+";";
        c.classList.add("mu2e_list")
        c.innerHTML = contextName
        div.appendChild(c);
    });
}

async function updateAppStatus(includeApps=false) {
    let div = document.getElementById("mu2e_apps");
    if(div==undefined) return;
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
                        // add link to reconfigure
                        let state = document.querySelector("#state");
                        if(state) {
                            state.innerHTML += 
                            "<span class=\"mu2e_right_float\"><a href=\"#\" style=\"text-decoration:none;\" alt=\"Reconfigure\" onClick='transition(\"Halt\")'>&#x21bb</a></span>";
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
                            button.addEventListener("click", function (e) {transition('Stop');});
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
                    updateRunInfo();
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

function addNav() {
    let nav = document.querySelector("div[id='mu2e_nav']")
    let overview = document.createElement("a")
    overview.href="Mu2eIndex.html"
    overview.innerHTML = "Overview"
    overview.id = "Index"
    let alarms = document.createElement("a")
    alarms.href="Mu2eAlarms.html"
    alarms.innerHTML = "Alarms"
    alarms.id = "Alarms"
    let message = document.createElement("a")
    message.href="Mu2eMessages.html"
    message.innerHTML = "Messages"
    message.id = "Messages"
    let runlog = document.createElement("a")
    runlog.href="Mu2eRunLog.html"
    runlog.innerHTML = "Run Log"
    runlog.id = "RunLog"
    if(nav) {
        nav.appendChild(overview)
        nav.appendChild(alarms)
        nav.appendChild(message)
        nav.appendChild(runlog)

        nav.appendChild(document.createElement("br"))
    }
}

function updateNav(active) {
    let nav_active = document.querySelector("div[id='mu2e_nav'] a[id='"+active+"']")
    if(nav_active) nav_active.classList.add("mu2e_nav_active")
}

// uses global mu2e_dcs_channels
async function handleEPICS() {
    let res = await getPvData(mu2e_dcs_channels);
    if(res == undefined) return;
    Object.entries(res).forEach(([pvName, pv]) => {
        document.querySelectorAll('div[data="'+pvName+'"]').forEach(div => {
            let value = pv["Value"];
            if(format = div.getAttribute("format")) {
                if(!isNaN(Number(format))) // number of digis
                    value = Number(value).toFixed(format)
                else if(format == "hex") {
                    value = "0x" + Number(value).toString(16)
                }
                
            }
            //if(title = div.getAttribute("title"))
            //    value = title+": "+value
            if(units = div.getAttribute("units"))
                value += " "+units
            div.textContent = value;
            if((pv["Severity"] == "MINOR")) {
                setStatusColor(div,"mu2e_warning");
            } else if((pv["Severity"] == "MAJOR")) {
                setStatusColor(div,"mu2e_bad");
            } else {
                setStatusColor(div,"");
            }

            const time = new Date(Number(pv["Timestamp"])*1000);
            const dtime = Math.floor(Date.now() / 1000) - Number(pv["Timestamp"])

            addTime(div, time, dtime)

            // handle bitfields
            if(bitfield_group = div.getAttribute("bitfield")) {
                document.querySelectorAll('div[name="'+bitfield_group+'"]').forEach(div_ => {
                    const bit = div_.getAttribute("bit")
                    if(bit) {
                        let span = div_.querySelector("span")
                        if(span == undefined) {
                            span = document.createElement("span")
                            div_.appendChild(span)
                        }
                        console.log()
                        span.innerHTML = (parseInt(pv["Value"]) & (1<<bit)) !== 0 ? "[x]" : "[   ]";
                    }

                });
            }
            // handle callback functions
            if(callback = div.getAttribute("callback")) {
                window[callback](div);
            }
        });
    });
}

async function updateAlarms() {
    let div = document.querySelector("div[id='mu2e_alarms']")
    if(div == undefined) return;
    let res = await getAlarmChecks();
 
    let rowindex_start = 3;
    let rowidx = rowindex_start;
    let channels_ = []; // store all channels to load settings afterwards
    res["alarms"].forEach(alarm => {
        let name = document.createElement("div")
        name.style.cssText = "grid-column: 1; grid-row: "+rowidx.toString();
        name.classList.add("mu2e_list")
        name.innerHTML = alarm["name"].substring(14)
        let val = document.createElement("div")
        val.style.cssText = "grid-column: 2; grid-row: "+rowidx.toString();
        val.classList.add("mu2e_list")
        val.setAttribute("name", "mu2e_dcs")
        val.setAttribute("data", alarm["name"])
        val.setAttribute("format", "2")
        div.appendChild(name)
        div.appendChild(val)

        channels_.push(alarm["name"])
        rowidx++;
    });
    loadDcsChannels();

    let settings = await getPVSettings(channels_);
    rowidx = rowindex_start;
    res["alarms"].forEach(alarm => { // secnd loop too load settings
        let alarmName = alarm["name"]
        let hi = document.createElement("div")
        hi.style.cssText = "grid-column: 5; grid-row: "+rowidx.toString();
        hi.classList.add("mu2e_list")
        hi.innerHTML = Number(settings[alarmName]["Upper_Warning_Limit"]).toFixed(2)
        div.appendChild(hi)
        let hihi = document.createElement("div")
        hihi.style.cssText = "grid-column: 6; grid-row: "+rowidx.toString();
        hihi.classList.add("mu2e_list")
        hihi.innerHTML = Number(settings[alarmName]["Upper_Alarm_Limit"]).toFixed(2)
        div.appendChild(hihi)
        let lo = document.createElement("div")
        lo.style.cssText = "grid-column: 4; grid-row: "+rowidx.toString();
        lo.classList.add("mu2e_list")
        lo.innerHTML = Number(settings[alarmName]["Lower_Warning_Limit"]).toFixed(2)
        div.appendChild(lo)
        let lolo = document.createElement("div")
        lolo.style.cssText = "grid-column: 3; grid-row: "+rowidx.toString();
        lolo.classList.add("mu2e_list")
        lolo.innerHTML = Number(settings[alarmName]["Lower_Alarm_Limit"]).toFixed(2)
        div.appendChild(lolo)
        rowidx++;
    });
}

function addMsg(time, msg) {
    let row = document.createElement("div")
    row.classList.add("mu2e_grid")
    row.style.padding = "2px";
    row.setAttribute("name","msg_row")
    //row.classList.add("mu2e_container")
    let row_time = document.createElement("div")
    row_time.classList.add("mu2e_list")
    row_time.style.cssText = "grid-column: 1; grid-row: 1";
    row_time.innerHTML = time.toLocaleTimeString(['en-GB'], {hour: '2-digit', minute: '2-digit', second: '2-digit' })+"&nbsp;"
    row.appendChild(row_time)
    let row_msg = document.createElement("div")
    row_msg.classList.add("mu2e_list")
    row_msg.style.cssText = "grid-column: 2/6; grid-row: 1";
    row_msg.setAttribute("name","msg_msg")
    //row_msg.appendChild(row_time)
    row_msg.innerHTML += msg
    //addTime(row_msg, time)
    row.appendChild(row_msg)
    return row;
}

async function updateMessages() {
    let div = document.querySelector("div[id='mu2e_messages']")
    let div_last = document.querySelector("div[id='mu2e_last_message']")
    if((div == undefined) && (div_last == undefined)) return;
    let res = await getSystemMessages(history=true);
    for(let i = res["systemMessages"].length-1; i >=0; i-- ) {
        const msg = res["systemMessages"][i];
    //res["systemMessages"].forEach(msg => {
        let time = new Date(Number(msg["time"])*1000);
        const row = addMsg(time, msg["message"]);
        if(div) div.appendChild(row)
        if((i == res["systemMessages"].length-1) && (div_last)) {
            div_last.innerHTML = ""
            div_last.appendChild(row)
        }
    //});
    }

}
async function handleMessages() {
    let res = await getSystemMessages();
    if(res["systemMessages"]) {
        res["systemMessages"].forEach(msg => {
            let time = new Date(Number(msg["time"])*1000);
            const row = addMsg(time, msg["message"]);
            setStatusColor(row, "mu2e_warning");
            let div = document.querySelector("div[id='mu2e_messages']")
            if(div) { 
                let div_first = div.querySelector("div[name='msg_row']>div[name='msg_msg']")
                if(div_first == undefined || (div_first.innerHTML != msg["message"])) {
                    //div.appendChild(row);
                    div.insertBefore(row, div.children[1]);
                } else if(div_first) {
                    let div_row = div.querySelector("div[name='msg_row']")
                    setStatusColor(div_row, "")
                }
            }
            let div_last = document.querySelector("div[id='mu2e_last_message']")
            if(div_last) {
                let div_first = div_last.querySelector("div[name='msg_row']>div[name='msg_msg']")
                if(div_first == undefined || (div_first.innerHTML != msg["message"])) {
                    div_last.innerHTML = ""
                    div_last.appendChild(row);
                } else {
                    let div_row = div_last.querySelector("div[name='msg_row']")
                    setStatusColor(div_row, "")
                }
            }
        });
    }
}

async function updateRunInfo() {
    console.log("updateRunInfo")
    // check if we should do it
    let divs = document.querySelectorAll('div[name="mu2e_run_number"]')
    if(divs) { // only get data if we need it
        let res = await getRunInfo(); // no argument: get current run number
        if((res != undefined) && ("error" in res["plugin"])) { // handle case where no run is defined
            divs.forEach(div => {
                div.innerHTML = "Run: N/A";//res["plugin"]["error"]
            });
        } else if(res != undefined) {
            const plugin = res["plugin"];
            divs.forEach(div => { // mu2e_run_number
                let a = document.createElement("a")
                a.href = "Mu2eRunLog.html"
                a.innerHTML = plugin["run_number"]
                div.innerHTML = ""
                div.appendChild(a)
                div.innerHTML = "Run: " + div.innerHTML;

                //let time = new Date(plugin["time"])
                //addTime(div, time)
            });
            document.querySelectorAll('div[name="mu2e_run_start"]').forEach(div => {
                let time = new Date(plugin["time"])
                //addTime(div, time)
                div.innerHTML = "Run start: "+time.toLocaleTimeString(['en-GB'], {hour: '2-digit', minute: '2-digit', second: '2-digit' })
            });
            document.querySelectorAll('div[name="mu2e_run_config"]').forEach(div => {
                div.innerHTML = "Run config: "+plugin["configuration"]+" ("+plugin["configuration_version"]+")";
                //div.innerHTML += 
            });
            //document.querySelectorAll('div[name="mu2e_run_trigger"]').forEach(div => {
            //    div.innerHTML = plugin["configuration"]+"("+plugin["configuration_version"]+")";
            //});
            document.querySelectorAll('div[name="mu2e_run_type"]').forEach(div => {
                div.innerHTML = "Run type: "+plugin["run_type"];//+"("+plugin["host_name"]+" - "+plugin["artdaq_partition"]+")"
                //div.innerHTML += ": "+plugin["artdaq_partition"]
            });
            document.querySelectorAll('div[name="mu2e_run_host"]').forEach(div => {
                div.innerHTML = "Run host: "+plugin["host_name"]+" ("+plugin["artdaq_partition"]+")"
            });
            document.querySelectorAll('div[name="mu2e_run_transition"]').forEach(div => {
                const transitions = plugin["transitions"];
                console.log(transitions)
                const t_idx = transitions.length-1;
                if(t_idx>=0) {
                    const time = new Date(transitions[t_idx]["time"]);
                    const msg  = transitions[t_idx]["type"];
                    div.innerHTML = "Last run transition: "
                    div.innerHTML += time.toLocaleTimeString(['en-GB'], {hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    div.innerHTML += " "+msg
                }
            });
            document.querySelectorAll('div[name="mu2e_run_transitions"]').forEach(div => {
                const transitions = plugin["transitions"];
                for(let idx = transitions.length-1; idx >= 0; idx--) {
                //transitions.forEach(transition => {
                    const transition = transitions[idx]
                    let line = document.createElement("div")
                    let time = new Date(transition["time"]);
                    line.innerHTML = time.toLocaleTimeString(['en-GB'], {hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    line.innerHTML += " "+transition["type"]
                    div.appendChild(line)
                //});
                }
            });
        }
    }
}

async function loadRunLog(n=10) {
    let div = document.querySelector('div[id="mu2e_runlog"]')
    if(div) {
        let rowid = 3;
        let res = await getRunInfo(-n);
        if((res != undefined) && ("runs" in res["plugin"])) {
            res["plugin"]["runs"].forEach(run => {
                let run_number = document.createElement("div")
                run_number.style.cssText = "grid-column: 1; grid-row: "+rowid.toString()+";"
                run_number.classList.add("mu2e_list")
                run_number.innerHTML = run["run_number"]
                div.appendChild(run_number)

                let run_time = document.createElement("div")
                run_time.style.cssText = "grid-column: 2; grid-row: "+rowid.toString()+";"
                run_time.classList.add("mu2e_list")
                let time = new Date(run["time"])
                run_time.innerHTML = time.toLocaleTimeString(['en-US'], {year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
                div.appendChild(run_time)

                let run_trans = document.createElement("div")
                run_trans.style.cssText = "grid-column: 3; grid-row: "+rowid.toString()+";"
                run_trans.classList.add("mu2e_list")
                let trans_time = new Date(run["last_transition_time"])
                run_trans.innerHTML = trans_time.toLocaleTimeString(['en-GB'], {hour: '2-digit', minute: '2-digit', second: '2-digit' })
                run_trans.innerHTML += " "+run["last_transition"];
                div.appendChild(run_trans)

                let run_type = document.createElement("div")
                run_type.style.cssText = "grid-column: 4; grid-row: "+rowid.toString()+";"
                run_type.classList.add("mu2e_list")
                run_type.innerHTML = run["run_type"]+" - "+run["configuration"]+" ("+run["configuration_version"]+")";
                div.appendChild(run_type)

                let run_host = document.createElement("div")
                run_host.style.cssText = "grid-column: 5; grid-row: "+rowid.toString()+";"
                run_host.classList.add("mu2e_list")
                run_host.innerHTML = run["host_name"]+" ("+run["artdaq_partition"]+")";
                div.appendChild(run_host)
                rowid++;
            });
        }
    }
}

async function handleAlarms() {
    let res = await getAlarmChecks();
    const  nactive = res!=undefined ? res["nactive"] : undefined;
    const total = res!=undefined ? res["total"] : undefined;
    document.querySelectorAll('div[name="mu2e_alarms"]').forEach(div => {
        let a = div.querySelector("a")
        if(a == undefined) {
            a = document.createElement("a")
            a.href = "Mu2eAlarms.html"
            div.appendChild(a)
        }
        if(nactive != undefined) {
            a.innerHTML = "Alarms: " + nactive.toString()+"/"+total.toString()
            if(nactive>0) {
                setStatusColor(div, "mu2e_bad")
            } else {
                setStatusColor(div, "")
            }
            const time = new Date(Number(res["last_check"])*1000);
            const dtime = Math.floor(Date.now() / 1000) - Number(res["last_check"])
            addTime(div, time, dtime)
        } else {
            a.innerHTML = "Alarms: Off"
            setStatusColor(div, "mu2e_warning")
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