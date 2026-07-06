
var test = null;

var state = document.getElementById('content-capture');

var myVal = ""; // Drop down selected value of reader 
var disabled = true;
var startEnroll = false;
var linuxFallbackReaderId = "linux-uvc:auto";
var linuxFallbackReaderLabel = "DigitalPersona Linux UVC (/dev/video2)";
var linuxCaptureRun = 0;
var linuxCaptureActive = false;

var currentFormat = Fingerprint.SampleFormat.PngImage;
var deviceTechn = {
               0: "Unknown",
               1: "Optical",
               2: "Capacitive",
               3: "Thermal",
               4: "Pressure"
            }

var deviceModality = {
               0: "Unknown",
               1: "Swipe",
               2: "Area",
               3: "AreaMultifinger"
            }

var deviceUidType = {
               0: "Persistent",
               1: "Volatile"
            }

var FingerprintSdkTest = (function () {
    function FingerprintSdkTest() {
        var _instance = this;
        this.operationToRestart = null;
        this.acquisitionStarted = false;
        this.sdk = new Fingerprint.WebApi;
        this.sdk.onDeviceConnected = function (e) {
            // Detects if the deveice is connected for which acquisition started
            showMessage("Scan your finger");
        };
        this.sdk.onDeviceDisconnected = function (e) {
            // Detects if device gets disconnected - provides deviceUid of disconnected device
            showMessage("Device disconnected");
        };
        this.sdk.onCommunicationFailed = function (e) {
            // Detects if there is a failure in communicating with U.R.U web SDK
            showMessage("Communinication Failed")
        };
        this.sdk.onSamplesAcquired = function (s) {
            // Sample acquired event triggers this function
                sampleAcquired(s);
        };
        this.sdk.onQualityReported = function (e) {
            // Quality of sample aquired - Function triggered on every sample acquired
                document.getElementById("qualityInputBox").value = Fingerprint.QualityCode[(e.quality)];
        }

    }

    FingerprintSdkTest.prototype.startCapture = function () {
        if (this.acquisitionStarted) // Monitoring if already started capturing
            return;
        var _instance = this;
        showMessage("");
        this.operationToRestart = this.startCapture;
        this.sdk.startAcquisition(currentFormat, myVal).then(function () {
            _instance.acquisitionStarted = true;

            //Disabling start once started
            disableEnableStartStop();

        }, function (error) {
            showMessage(error.message);
        });
    };
    FingerprintSdkTest.prototype.stopCapture = function () {
        if (!this.acquisitionStarted) //Monitor if already stopped capturing
            return;
        var _instance = this;
        showMessage("");
        this.sdk.stopAcquisition().then(function () {
            _instance.acquisitionStarted = false;

            //Disabling stop once stoped
            disableEnableStartStop();

        }, function (error) {
            showMessage(error.message);
        });
    };

    FingerprintSdkTest.prototype.getInfo = function () {
        var _instance = this;
        return this.sdk.enumerateDevices();
    };

    FingerprintSdkTest.prototype.getDeviceInfoWithID = function (uid) {
        var _instance = this;
        return  this.sdk.getDeviceInfo(uid);
    };

    
    return FingerprintSdkTest;
})();

function showMessage(message){
    var _instance = this;
    //var statusWindow = document.getElementById("status");
    x = state.querySelectorAll("#status");
    if(x.length != 0){
        x[0].innerHTML = message;
    }
}

window.onload = function () {
    localStorage.clear();
    test = new FingerprintSdkTest();
    readersDropDownPopulate(true); //To populate readers for drop down selection
    disableEnable(); // Disabling enabling buttons - if reader not selected
    enableDisableScanQualityDiv("content-reader"); // To enable disable scan quality div
    disableEnableExport(true);
    refreshFmdList();
};


function onStart() {
    if (isLinuxFallbackSelected()) {
        onLinuxCapture();
        return;
    }
    assignFormat();
    if(currentFormat == ""){
        alert("Please select a format.")
    }else{        
        test.startCapture();
    }
}

function onStop() {
    if (isLinuxFallbackSelected()) {
        linuxCaptureRun++;
        linuxCaptureActive = false;
        showMessage("Linux UVC standby stopped.");
        setApprovalResult("Standby stopped.", "");
        disableEnableStartStop();
        return;
    }
    test.stopCapture();
}

function onGetInfo() {
    if (isLinuxFallbackSelected()) {
        onLinuxStatus();
        return;
    }
    var allReaders = test.getInfo();    
    allReaders.then(function (sucessObj) {
        populateReaders(sucessObj);
    }, function (error){
        showMessage(error.message);
    });
}
function onDeviceInfo(id, element){
    if (id === linuxFallbackReaderId) {
        fetch("reader_status.php")
            .then(function(response) { return response.json(); })
            .then(function(data) {
                var target = data.devices.find(function(item) {
                    return item.digitalpersona && item.capture;
                });
                document.getElementById(element).innerHTML = target
                    ? "Id : " + linuxFallbackReaderId + "<br> Node : " + target.node + "<br> " + target.summary
                    : "Linux UVC reader not ready.";
            })
            .catch(function(error) {
                document.getElementById(element).innerHTML = error.message;
            });
        return;
    }
    var myDeviceVal = test.getDeviceInfoWithID(id);
    myDeviceVal.then(function (sucessObj) {
            var deviceId = sucessObj.DeviceID;
            var uidTyp = deviceUidType[sucessObj.eUidType];
            var modality = deviceModality[sucessObj.eDeviceModality];
            var deviceTech = deviceTechn[sucessObj.eDeviceTech];
            //Another method to get Device technology directly from SDK
            //Uncomment the below logging messages to see it working, Similarly for DeviceUidType and DeviceModality
            //console.log(Fingerprint.DeviceTechnology[sucessObj.eDeviceTech]);            
            //console.log(Fingerprint.DeviceModality[sucessObj.eDeviceModality]);
            //console.log(Fingerprint.DeviceUidType[sucessObj.eUidType]);
            var retutnVal = //"Device Info -"
                 "Id : " +  deviceId
                +"<br> Uid Type : "+ uidTyp
                +"<br> Device Tech : " +  deviceTech
                +"<br> Device Modality : " +  modality;

            document.getElementById(element).innerHTML = retutnVal;

        }, function (error){
            showMessage(error.message);
        });

}
function onClear() {
         var vDiv = document.getElementById('imagediv');
         vDiv.innerHTML = "";
         localStorage.setItem("imageSrc", "");
         localStorage.setItem("wsq", "");
         localStorage.setItem("raw", "");
         localStorage.setItem("intermediate", "");
         localStorage.setItem("linuxUvcPng", "");
         localStorage.setItem("linuxUvcDevice", "");
         setApprovalResult("Capture cleared.", "");
         setDemoResult("", "");

         disableEnableExport(true);
}

function toggle_visibility(ids) {
    document.getElementById("qualityInputBox").value = "";
    onStop();
    enableDisableScanQualityDiv(ids[0]); // To enable disable scan quality div
    for (var i=0;i<ids.length;i++) {        
       var e = document.getElementById(ids[i]);
        if(i == 0){
            e.style.display = 'block';
            state = e;
            disableEnable();
        }
       else{
            e.style.display = 'none';
       }
   }
}


$("#save").on("click",function(){
    if(localStorage.getItem("imageSrc") == "" || localStorage.getItem("imageSrc") == null || document.getElementById('imagediv').innerHTML == ""){
        alert("Error -> Fingerprint not available");
    }else{
        var vDiv = document.getElementById('imageGallery');
        if(vDiv.children.length < 5){
            var image = document.createElement("img");
            image.id = "galleryImage";
            image.className = "img-thumbnail";
            image.src = localStorage.getItem("imageSrc");
            vDiv.appendChild(image);

            localStorage.setItem("imageSrc"+vDiv.children.length,localStorage.getItem("imageSrc"));
        }else{
            document.getElementById('imageGallery').innerHTML = "";
            $("#save").click();
        }
    }
});

function populateReaders(readersArray) {
        var _deviceInfoTable = document.getElementById("deviceInfo");
        _deviceInfoTable.innerHTML = "";
        if(readersArray.length != 0){
            _deviceInfoTable.innerHTML += "<h4>Available Readers</h4>"
            for (i=0;i<readersArray.length;i++){ 
                _deviceInfoTable.innerHTML += 
                "<div id='dynamicInfoDivs' align='left'>"+
                    "<div data-toggle='collapse' data-target='#"+readersArray[i]+"'>"+
                        "<img src='images/info.png' alt='Info' height='20' width='20'> &nbsp; &nbsp;"+readersArray[i]+"</div>"+
                        "<p class='collapse' id="+'"' + readersArray[i] + '"'+">"+onDeviceInfo(readersArray[i],readersArray[i])+"</p>"+
                    "</div>";
            }
        }
        if (!readersArray.includes(linuxFallbackReaderId)) {
            _deviceInfoTable.innerHTML +=
                "<div id='dynamicInfoDivs' align='left'>" +
                "<div data-toggle='collapse' data-target='#linuxUvcInfo'>" +
                "<img src='images/info.png' alt='Info' height='20' width='20'> &nbsp; &nbsp;" +
                linuxFallbackReaderLabel + "</div>" +
                "<p class='collapse' id='linuxUvcInfo'>Linux UVC fallback for /dev/video2</p>" +
                "</div>";
        }
    };

function sampleAcquired(s){   
            if(currentFormat == Fingerprint.SampleFormat.PngImage){   
            // If sample acquired format is PNG- perform following call on object recieved 
            // Get samples from the object - get 0th element of samples as base 64 encoded PNG image         
                localStorage.setItem("imageSrc", "");                
                var samples = JSON.parse(s.samples);            
                localStorage.setItem("imageSrc", "data:image/png;base64," + Fingerprint.b64UrlTo64(samples[0]));
                if(state == document.getElementById("content-capture")){ 
                    var vDiv = document.getElementById('imagediv');
                    vDiv.innerHTML = "";
                    var image = document.createElement("img");
                    image.id = "image";
                    image.src = localStorage.getItem("imageSrc");
                    vDiv.appendChild(image); 
                }

                disableEnableExport(false);
            }

            else if(currentFormat == Fingerprint.SampleFormat.Raw){  
                // If sample acquired format is RAW- perform following call on object recieved 
                // Get samples from the object - get 0th element of samples and then get Data from it.
                // Returned data is Base 64 encoded, which needs to get decoded to UTF8,
                // after decoding get Data key from it, it returns Base64 encoded raw image data
                localStorage.setItem("raw", "");
                var samples = JSON.parse(s.samples);
                var sampleData = Fingerprint.b64UrlTo64(samples[0].Data);
                var decodedData = JSON.parse(Fingerprint.b64UrlToUtf8(sampleData));
                localStorage.setItem("raw", Fingerprint.b64UrlTo64(decodedData.Data));

                var vDiv = document.getElementById('imagediv').innerHTML = '<div id="animateText" style="display:none">RAW Sample Acquired <br>'+Date()+'</div>';
                setTimeout('delayAnimate("animateText","table-cell")',100); 

                disableEnableExport(false);
            }

            else if(currentFormat == Fingerprint.SampleFormat.Compressed){  
                // If sample acquired format is Compressed- perform following call on object recieved 
                // Get samples from the object - get 0th element of samples and then get Data from it.
                // Returned data is Base 64 encoded, which needs to get decoded to UTF8,
                // after decoding get Data key from it, it returns Base64 encoded wsq image
                localStorage.setItem("wsq", "");
                var samples = JSON.parse(s.samples);
                var sampleData = Fingerprint.b64UrlTo64(samples[0].Data);
                var decodedData = JSON.parse(Fingerprint.b64UrlToUtf8(sampleData));
                localStorage.setItem("wsq","data:application/octet-stream;base64," + Fingerprint.b64UrlTo64(decodedData.Data));

                var vDiv = document.getElementById('imagediv').innerHTML = '<div id="animateText" style="display:none">WSQ Sample Acquired <br>'+Date()+'</div>';
                setTimeout('delayAnimate("animateText","table-cell")',100);   

                disableEnableExport(false);
            }

            else if(currentFormat == Fingerprint.SampleFormat.Intermediate){  
                // If sample acquired format is Intermediate- perform following call on object recieved 
                // Get samples from the object - get 0th element of samples and then get Data from it.
                // It returns Base64 encoded feature set
                localStorage.setItem("intermediate", "");
                var samples = JSON.parse(s.samples);
                var sampleData = Fingerprint.b64UrlTo64(samples[0].Data);
                localStorage.setItem("intermediate", sampleData);

                var vDiv = document.getElementById('imagediv').innerHTML = '<div id="animateText" style="display:none">Intermediate Sample Acquired <br>'+Date()+'</div>';
                setTimeout('delayAnimate("animateText","table-cell")',100); 

                disableEnableExport(false);
            }

            else{
                alert("Format Error");
                //disableEnableExport(true);
            }    
}

function readersDropDownPopulate(checkForRedirecting){ // Check for redirecting is a boolean value which monitors to redirect to content tab or not
    myVal = "";
    var allReaders = test.getInfo();
    allReaders.then(function (sucessObj) {        
        var readersDropDownElement = document.getElementById("readersDropDown");
        readersDropDownElement.innerHTML ="";
        //First ELement
        var option = document.createElement("option");
        option.selected = "selected";
        option.value = "";
        option.text = "Select Reader";
        readersDropDownElement.add(option);
        for (i=0;i<sucessObj.length;i++){ 
            var option = document.createElement("option");
            option.value = sucessObj[i];
            option.text = sucessObj[i];
            readersDropDownElement.add(option);
        }
        addLinuxFallbackOption(readersDropDownElement);

    //Check if readers are available get count and  provide user information if no reader available, 
    //if only one reader available then select the reader by default and sennd user to capture tab
    checkReaderCount(sucessObj,checkForRedirecting);

    }, function (error){
        showMessage(error.message);
        var readersDropDownElement = document.getElementById("readersDropDown");
        readersDropDownElement.innerHTML = "";
        var option = document.createElement("option");
        option.selected = "selected";
        option.value = "";
        option.text = "Select Reader";
        readersDropDownElement.add(option);
        addLinuxFallbackOption(readersDropDownElement);
        checkReaderCount([linuxFallbackReaderId], checkForRedirecting);
    });
}

function checkReaderCount(sucessObj,checkForRedirecting){
   if(sucessObj.length == 0){
    addLinuxFallbackOption(document.getElementById("readersDropDown"));
    showMessage("No HID WebAPI reader detected. Linux UVC fallback is available.");
   }else if(sucessObj.length == 1){
        document.getElementById("readersDropDown").selectedIndex = "1";
        if(checkForRedirecting){
            toggle_visibility(['content-capture','content-reader']);    
            enableDisableScanQualityDiv("content-capture"); // To enable disable scan quality div
            setActive('Capture','Reader'); // Set active state to capture
        }
   }

    selectChangeEvent(); // To make the reader selected
}

function selectChangeEvent(){
    var readersDropDownElement = document.getElementById("readersDropDown");
    myVal = readersDropDownElement.options[readersDropDownElement.selectedIndex].value;
    disableEnable();
    onClear();
    document.getElementById('imageGallery').innerHTML = "";

    //Make capabilities button disable if no user selected
    if(myVal == ""){
        $('#capabilities').prop('disabled', true);
    }else{
        $('#capabilities').prop('disabled', false);
    }
}

function populatePopUpModal(){
    var modelWindowElement = document.getElementById("ReaderInformationFromDropDown");
    modelWindowElement.innerHTML = "";
    if(myVal != ""){
        onDeviceInfo(myVal,"ReaderInformationFromDropDown");
    }else{
        modelWindowElement.innerHTML = "Please select a reader";
    }
}

//Enable disable buttons
function disableEnable(){

    if(isLinuxFallbackSelected()){
        disabled = false;
        $('#start').prop('disabled', false);
        $('#stop').prop('disabled', true);
        $('#capabilities').prop('disabled', false);
        showMessage("Linux UVC fallback selected. Use Linux Capture or Start.");
    }else if(myVal != ""){
        disabled = false;
        $('#start').prop('disabled', false);
        $('#stop').prop('disabled', false);
        showMessage("");
        disableEnableStartStop();
    }else{
        disabled = true;
        $('#start').prop('disabled', true);
        $('#stop').prop('disabled', true);
        showMessage("Please select a reader");
        onStop();
    }
}


// Start-- Optional to make GUi user frindly 
//To make Start and stop buttons selection mutually exclusive
$('body').click(function(){disableEnableStartStop();});

function disableEnableStartStop(){
     if(isLinuxFallbackSelected()){
        $('#start').prop('disabled', linuxCaptureActive);
        $('#stop').prop('disabled', !linuxCaptureActive);
     }else if(!myVal == ""){
        if(test.acquisitionStarted){
            $('#start').prop('disabled', true);
            $('#stop').prop('disabled', false);
        }else{
            $('#start').prop('disabled', false);
            $('#stop').prop('disabled', true); 
        }
    }
}

// Stop-- Optional to make GUI user freindly


function enableDisableScanQualityDiv(id){
    if(id == "content-reader"){
        document.getElementById('Scores').style.display = 'none';
    }else{
        document.getElementById('Scores').style.display = 'block';
    }
}


function setActive(element1,element2){
    document.getElementById(element2).className = "";

    // And make this active
   document.getElementById(element1).className = "active";

}



// For Download and formats starts

function onImageDownload(){
    if(currentFormat == Fingerprint.SampleFormat.PngImage){
        if(localStorage.getItem("imageSrc") == "" || localStorage.getItem("imageSrc") == null || document.getElementById('imagediv').innerHTML == "" ){
           alert("No image to download");
        }else{
            //alert(localStorage.getItem("imageSrc"));
            downloadURI(localStorage.getItem("imageSrc"), "sampleImage.png", "image/png");
        }
    }

    else if(currentFormat == Fingerprint.SampleFormat.Compressed){
         if(localStorage.getItem("wsq") == "" || localStorage.getItem("wsq") == null || document.getElementById('imagediv').innerHTML == "" ){
           alert("WSQ data not available.");
        }else{
            downloadURI(localStorage.getItem("wsq"), "compressed.wsq","application/octet-stream");
        }
    }

    else if(currentFormat == Fingerprint.SampleFormat.Raw){
         if(localStorage.getItem("raw") == "" || localStorage.getItem("raw") == null || document.getElementById('imagediv').innerHTML == "" ){
           alert("RAW data not available.");
        }else{

            downloadURI("data:application/octet-stream;base64,"+localStorage.getItem("raw"), "rawImage.raw", "application/octet-stream");
        }
    }

    else if(currentFormat == Fingerprint.SampleFormat.Intermediate){
         if(localStorage.getItem("intermediate") == "" || localStorage.getItem("intermediate") == null || document.getElementById('imagediv').innerHTML == "" ){
           alert("Intermediate data not available.");
        }else{

            downloadURI("data:application/octet-stream;base64,"+localStorage.getItem("intermediate"), "fingerprint.fmd", "application/octet-stream");
        }
    }

    else{
        alert("Nothing to download.");
    }
}


function downloadURI(uri, name, dataURIType) {
    if (IeVersionInfo() > 0){ 
    //alert("This is IE " + IeVersionInfo());
    var blob = dataURItoBlob(uri,dataURIType);
    window.navigator.msSaveOrOpenBlob(blob, name);

    }else {
        //alert("This is not IE.");
        var save = document.createElement('a');
        save.href = uri;
        save.download = name;
        var event = document.createEvent("MouseEvents");
            event.initMouseEvent(
                    "click", true, false, window, 0, 0, 0, 0, 0
                    , false, false, false, false, 0, null
            );
        save.dispatchEvent(event);
    }
}

dataURItoBlob = function(dataURI, dataURIType) {
    var binary = atob(dataURI.split(',')[1]);
    var array = [];
    for(var i = 0; i < binary.length; i++) {
        array.push(binary.charCodeAt(i));
    }
    return new Blob([new Uint8Array(array)], {type: dataURIType});
}


function IeVersionInfo() {
  var sAgent = window.navigator.userAgent;
  var IEVersion = sAgent.indexOf("MSIE");

  // If IE, return version number.
  if (IEVersion > 0) 
    return parseInt(sAgent.substring(IEVersion+ 5, sAgent.indexOf(".", IEVersion)));

  // If IE 11 then look for Updated user agent string.
  else if (!!navigator.userAgent.match(/Trident\/7\./)) 
    return 11;

  // Quick and dirty test for Microsoft Edge
  else if (document.documentMode || /Edge/.test(navigator.userAgent))
    return 12;

  else
    return 0; //If not IE return 0
}


$(document).ready(function(){
  $('[data-toggle="tooltip"]').tooltip();   
});

function checkOnly(stayChecked)
{
    disableEnableExport(true);
    onClear();
    onStop();
with(document.myForm)
  {
  for(i = 0; i < elements.length; i++)
    {
    if(elements[i].checked == true && elements[i].name != stayChecked.name)
      {
      elements[i].checked = false;
      }
    }
    //Enable disable save button
    for(i = 0; i < elements.length; i++)
    {
    if(elements[i].checked == true)
      {
        if(elements[i].name =="PngImage"){
            disableEnableSaveThumbnails(false);
        }else{
            disableEnableSaveThumbnails(true);
        }
      }
    }
  }
}         

function assignFormat(){
    currentFormat = "";
    with(document.myForm){
        for(i = 0; i < elements.length; i++){
            if(elements[i].checked == true){
                if(elements[i].name == "Raw"){
                    currentFormat = Fingerprint.SampleFormat.Raw;
                }
                if(elements[i].name == "Intermediate"){
                    currentFormat = Fingerprint.SampleFormat.Intermediate;
                }
                if(elements[i].name == "Compressed"){
                    currentFormat = Fingerprint.SampleFormat.Compressed;
                }
                if(elements[i].name == "PngImage"){
                    currentFormat = Fingerprint.SampleFormat.PngImage;
                }
            }
        }
    }
}


function disableEnableExport(val){
    if(val){
        $('#saveImagePng').prop('disabled', true);
    }else{
        $('#saveImagePng').prop('disabled', false); 
    }
}


function disableEnableSaveThumbnails(val){
    if(val){
        $('#save').prop('disabled', true);
    }else{
        $('#save').prop('disabled', false); 
    }
}


function delayAnimate(id,visibility)
{
   document.getElementById(id).style.display = visibility;
}

// For Download and formats ends

function isLinuxFallbackSelected() {
    return myVal === linuxFallbackReaderId;
}

function addLinuxFallbackOption(readersDropDownElement) {
    for (var idx = 0; idx < readersDropDownElement.options.length; idx++) {
        if (readersDropDownElement.options[idx].value === linuxFallbackReaderId) {
            return;
        }
    }
    var option = document.createElement("option");
    option.value = linuxFallbackReaderId;
    option.text = linuxFallbackReaderLabel;
    readersDropDownElement.add(option);
}

function getApprovalName() {
    return (document.getElementById("approvalName").value || "atasan").trim() || "atasan";
}

function getRequestUser() {
    return (document.getElementById("requestUser").value || "").trim();
}

function setApprovalResult(message, className) {
    var el = document.getElementById("approvalResult");
    el.className = className || "";
    el.textContent = message;
}

function setDemoResult(message, className) {
    var el = document.getElementById("demoResult");
    if (!el) return;
    el.className = className || "";
    el.textContent = message;
}

function apiJson(path, options) {
    return fetch(path, options || {}).then(function(response) {
        return response.text().then(function(text) {
            var data;
            try {
                data = JSON.parse(text);
            } catch (error) {
                throw new Error(text || "Response bukan JSON.");
            }
            if (!response.ok || data.success === false) {
                throw new Error(data.error || "Request gagal.");
            }
            return data;
        });
    });
}

function onLinuxStatus() {
    apiJson("reader_status.php").then(function(data) {
        var target = data.devices.find(function(item) {
            return item.digitalpersona && item.capture;
        });
        showMessage(target ? "Linux UVC ready: " + target.node : "Linux UVC reader not ready.");
    }).catch(function(error) {
        showMessage(error.message);
    });
}

function onLinuxCapture() {
    waitForLinuxFinger("capture").then(function(data) {
        showMessage("Linux UVC capture OK: " + data.device);
        setApprovalResult("Capture ready. Enroll or verify FMD.", "");
    }).catch(function(error) {
        if (error.message !== "cancelled") {
            showMessage(error.message);
            setApprovalResult(error.message, "bad");
        }
    });
}

function currentPngPayload() {
    var linux = localStorage.getItem("linuxUvcPng");
    if (linux) {
        return linux;
    }
    var imageSrc = localStorage.getItem("imageSrc");
    if (imageSrc && imageSrc.indexOf(",") >= 0) {
        return imageSrc.split(",")[1];
    }
    return "";
}

function onEnrollFmd() {
    var nama = getApprovalName();
    if (!isLinuxFallbackSelected()) {
        var image = currentPngPayload();
        if (!image) {
            alert("Capture PNG dulu.");
            return;
        }
        enrollFmdImage(nama, image);
        return;
    }
    setApprovalResult("Standby enroll " + nama + ". Tempel jari di reader...", "");
    waitForLinuxFinger("enroll").then(function(capture) {
        return enrollFmdImage(nama, capture.image);
    }).catch(function(error) {
        if (error.message !== "cancelled") {
            setApprovalResult(error.message, "bad");
        }
    });
}

function enrollFmdImage(nama, image) {
    setApprovalResult("Converting capture to FMD and enrolling " + nama + "...", "");
    return apiJson("prototype_enroll_fmd.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: nama, image: image })
    }).then(function(data) {
        setApprovalResult("ENROLLED: " + data.nama + " (" + data.samples + " sample)", "ok");
        refreshFmdList();
    }).catch(function(error) {
        setApprovalResult(error.message, "bad");
    });
}

function onEnrollFmdSet() {
    var nama = getApprovalName();
    if (!isLinuxFallbackSelected()) {
        alert("Enroll 3 Samples dipakai untuk Linux UVC mode. Pilih reader DigitalPersona Linux UVC dulu.");
        return;
    }
    enrollFmdSamples(nama, 3, 1);
}

function enrollFmdSamples(nama, total, current) {
    setApprovalResult("Enroll " + nama + " sample " + current + "/" + total + ". Tempel jari, tahan stabil...", "");
    waitForLinuxFinger("enroll-set").then(function(capture) {
        return apiJson("prototype_enroll_fmd.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nama: nama, image: capture.image })
        });
    }).then(function(data) {
        if (current >= total) {
            setApprovalResult("ENROLLED: " + data.nama + " total " + data.samples + " sample di SQL", "ok");
            refreshFmdList();
            return;
        }
        setApprovalResult("Sample " + current + "/" + total + " tersimpan. Lepas jari sebentar, lalu tempel lagi.", "ok");
        return wait(900).then(function() {
            return enrollFmdSamples(nama, total, current + 1);
        });
    }).catch(function(error) {
        if (error.message !== "cancelled") {
            setApprovalResult(error.message, "bad");
        }
    });
}

function onVerifyFmd() {
    var nama = getApprovalName();
    if (!isLinuxFallbackSelected()) {
        var image = currentPngPayload();
        if (!image) {
            alert("Capture PNG dulu.");
            return;
        }
        verifyFmdImage(nama, image);
        return;
    }
    setApprovalResult("Standby verify " + nama + ". Tempel jari di reader...", "");
    waitForLinuxFinger("verify").then(function(capture) {
        return verifyFmdImage(nama, capture.image);
    }).catch(function(error) {
        if (error.message !== "cancelled") {
            setApprovalResult(error.message, "bad");
        }
    });
}

function verifyFmdImage(nama, image) {
    setApprovalResult("Verifying approval for " + nama + "...", "");
    return apiJson("prototype_verify_fmd.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: nama, image: image })
    }).then(function(data) {
        if (data.matched) {
            setApprovalResult("APPROVED: " + data.nama + " | score=" + data.score + " threshold=" + data.threshold, "ok");
        } else {
            setApprovalResult("REJECTED: score=" + data.score + " threshold=" + data.threshold, "bad");
        }
        refreshFmdList();
    }).catch(function(error) {
        setApprovalResult(error.message, "bad");
    });
}

function onDemoApproval() {
    var requestedUser = getRequestUser();
    if (!requestedUser) {
        alert("Isi Demo request user dulu.");
        return;
    }
    if (!isLinuxFallbackSelected()) {
        var image = currentPngPayload();
        if (!image) {
            alert("Capture PNG dulu.");
            return;
        }
        identifyFmdImage(requestedUser, image);
        return;
    }
    setDemoResult("Request akses untuk " + requestedUser + ". Tempel jari untuk konfirmasi...", "");
    waitForLinuxFinger("demo-approval").then(function(capture) {
        return identifyFmdImage(requestedUser, capture.image);
    }).catch(function(error) {
        if (error.message !== "cancelled") {
            setDemoResult(error.message, "bad");
        }
    });
}

function identifyFmdImage(requestedUser, image) {
    setDemoResult("Identifying fingerprint against all SQL templates...", "");
    return apiJson("prototype_identify_fmd.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requested_user: requestedUser, image: image })
    }).then(function(data) {
        if (data.approved) {
            setDemoResult("DEMO APPROVED: request=" + requestedUser + " matched=" + data.nama + " score=" + data.score + " threshold=" + data.threshold, "ok");
        } else if (data.matched) {
            setDemoResult("DEMO REJECTED: request=" + requestedUser + " tapi fingerprint cocok dengan " + data.nama + " score=" + data.score, "bad");
        } else {
            setDemoResult("DEMO REJECTED: fingerprint tidak match dengan user mana pun. Best=" + (data.nama || "-") + " score=" + data.score + " threshold=" + data.threshold, "bad");
        }
        refreshFmdList();
        return data;
    }).catch(function(error) {
        setDemoResult(error.message, "bad");
    });
}

function waitForLinuxFinger(mode) {
    var runId = ++linuxCaptureRun;
    var maxAttempts = 25;
    var delayMs = 450;
    linuxCaptureActive = true;
    disableEnableStartStop();
    showMessage("Linux UVC standby. Tempel jari, tahan stabil...");
    setApprovalResult("Menunggu sidik jari valid...", "");

    function attempt(count) {
        if (runId !== linuxCaptureRun) {
            throw new Error("cancelled");
        }
        setApprovalResult("Menunggu sidik jari valid... percobaan " + count + "/" + maxAttempts, "");
        return apiJson("capture_uvc.php")
            .then(function(data) {
                renderLinuxCapture(data);
                return apiJson("prototype_probe_fmd.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image: data.image })
                }).then(function() {
                    return data;
                });
            })
            .catch(function(error) {
                if (runId !== linuxCaptureRun) {
                    throw new Error("cancelled");
                }
                if (count >= maxAttempts) {
                    throw new Error("Belum dapat sidik jari valid. Tempel jari lebih rata, tahan stabil, lalu coba lagi. Detail: " + error.message);
                }
                return wait(delayMs).then(function() {
                    return attempt(count + 1);
                });
            });
    }

    return attempt(1).then(function(data) {
        linuxCaptureActive = false;
        disableEnableStartStop();
        return data;
    }).catch(function(error) {
        linuxCaptureActive = false;
        disableEnableStartStop();
        throw error;
    });
}

function renderLinuxCapture(data) {
    var src = "data:image/png;base64," + data.image;
    localStorage.setItem("imageSrc", src);
    localStorage.setItem("linuxUvcPng", data.image);
    localStorage.setItem("linuxUvcDevice", data.device);

    var vDiv = document.getElementById('imagediv');
    vDiv.innerHTML = "";
    var image = document.createElement("img");
    image.id = "image";
    image.src = src;
    vDiv.appendChild(image);

    disableEnableExport(false);
}

function wait(ms) {
    return new Promise(function(resolve) {
        window.setTimeout(resolve, ms);
    });
}

function refreshFmdList() {
    apiJson("prototype_templates.php").then(function(data) {
        var list = document.getElementById("fmdList");
        if (!data.templates.length) {
            list.innerHTML = "<div>No FMD template saved yet.</div>";
            return;
        }
        list.innerHTML = data.templates.map(function(item) {
            return "<div><b>" + escapeHtml(item.nama) + "</b> - " + item.samples + " sample(s), updated " + escapeHtml(item.updated_at || item.created_at || "") + "</div>";
        }).join("");
    }).catch(function(error) {
        document.getElementById("fmdList").innerHTML = "<div>" + escapeHtml(error.message) + "</div>";
    });
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
