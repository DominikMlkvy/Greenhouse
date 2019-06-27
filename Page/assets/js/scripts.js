var dev_id=1;
var schedData= {};

function log_in() {
    var form = document.getElementsByTagName("form")[0];
    form.style.setProperty("cursor", "wait");
    var inputs = document.getElementsByTagName("input");
    for (i=0; i<inputs.length-1; i++){
        inputs[i].style.cursor="wait";
        inputs[i].disabled=true;
    }
    var button = document.getElementById("butt");
    button.style.cursor="wait";
    button.disabled=true;

    var login = document.getElementsByName("user")[0].value;
    var password = document.getElementsByName("password")[0].value;
    var logouts=document.getElementsByName("logout");
    var expires="";
    for (var i in logouts){
        if (logouts[i].checked){
            expires=logouts[i].value
        }
    }

    if (window.XMLHttpRequest) {
        xmlhttp = new XMLHttpRequest();
    } else {
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var response=JSON.parse(xmlhttp.response);
            sessionStorage.setItem("token", response.token);
            window.location.replace("/");

        } else if (this.readyState == 4 && this.status != 200) {
            var heading=document.getElementsByTagName("h2")[0];
            heading.innerText=this.response;
            heading.className="";

            var form = document.getElementsByTagName("form")[0];
            form.style.setProperty("cursor", "default");
            var inputs = document.getElementsByTagName("input");
            for (i=0; i<inputs.length-1; i++){
                //console.log(inputs[i].type);
                inputs[i].style.cursor="default";
                inputs[i].disabled=false;
                if ((inputs[i].type=="text")||(inputs[i].type=="password")){
                    inputs[i].value="";
                }
            }
            var button = document.getElementById("butt");
            button.style.cursor="default";
            button.disabled=false;

        }
    };
    xmlhttp.open("POST", "sign_in", true);
    xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xmlhttp.send("login=" + login + "&password=" + password +"&expires=" + expires);
}

function log_out() {
    sessionStorage.clear();
    window.location.replace("/login.html");

}
var ws
function start(){
    refresh("device_list", "devices", "greenhouse", "id", null, true);
    //ws = new WebSocket('ws://192.168.1.15:3000', 'echo-protocol');
    ws = new WebSocket('ws://localhost:3000', 'echo-protocol');
    //var ws = new WebSocket('wss://greenhouse.makers.sk', 'echo-protocol');

    ws.addEventListener("message", function(e) {
        lastMessage=new Date();
        var msg = JSON.parse(e.data);
        if ((msg.command == "refresh")&&(msg.dev_id == dev_id)){
            loadDevice(dev_id);

        } else if((msg.command== "camera")&&(msg.dev_id==dev_id)) {
            console.log(msg)
            showImage(msg.image)
        } else if((msg.command== "error")&&(msg.dev_id==dev_id)) {
            showIcon("error", true);
            document.getElementById("otherError").innerText=msg.text;
        }


    });
    timeout(1000);
    //hTimeout(1000*60*30);
    displayUser();


    google.charts.load('current', {'packages':['gauge']});
    google.charts.setOnLoadCallback(drawChart);
    //google.charts.setOnLoadCallback(drawHistoryChart);

    var date= new Date();
    document.getElementById("h_date").value = date.toISOString().split("T")[0];
    hTimeout(1000*60*30);



}

function showImage(image) {

    var source = 'data:image/jpeg;base64,'+image;
    var myImageElement = document.getElementById("camera");
    myImageElement.src = source;

}

function refresh(tabName, tabData, type=null, order='id', device=dev_id, firstRun=false){


    if(window.XMLHttpRequest){
        xmlhttp= new XMLHttpRequest();
    } else {
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            var data = (JSON.parse(this.response));
            /*if (JSON.stringify(data) === JSON.stringify(oldData)) {
                return;
            }*/

            if (tabData == "schedules") {
                //table.innerHTML = header +"<tr>" +table.rows[1].innerHTML+ "</tr>";
                var table = document.getElementById(tabName);
                var templateRow = table.rows[1].innerHTML;
                //for (var r in table.rows){
                for(var r=0; r<table.rows.length; r++){
                    //console.log (r);
                    for (var row in data){
                        if (table.rows[r].id== data[row].id){
                            table.rows[r].className = "live"

                            var elements=document.getElementsByClassName("sch"+data[row].id);
                            for (var e in elements){
                                switch (elements[e].name) {
                                    case "start":{
                                        if(elements[e].value!==data[row].start){
                                            elements[e].value = data[row].start;
                                        }
                                        break;
                                    }
                                    case "stop":{
                                        if(elements[e].value!==data[row].stop){
                                            elements[e].value = data[row].stop;
                                        }
                                        break;
                                    }
                                    case "state":{
                                        if(elements[e].value!==data[row].state){
                                            elements[e].value = !data[row].state;
                                            elements[e].checked=data[row].state;
                                            elements[e].indeterminate = false;
                                            elements[e].disabled=false;
                                        }
                                        break;
                                    }

                                }
                            }
                            delete data[row];
                        }
                    }
                    //console.log(table.rows[r].className);
                }
                for (var r=0; r<table.rows.length; r++){
                //for (var r in table.rows){
                    if (table.rows[r].className === "stable"){
                        //.log("stable"+r)

                    }
                    else if(table.rows[r].className ==="live"){
                        table.rows[r].classList.remove("live");
                        //console.log("live"+r)
                    } else{
                        table.deleteRow(r);
                       // console.log("deleting"+r)
                        r--
                    }
                }
                for (row in data){
                    var newRow=table.insertRow(table.rows.length-1);
                    newRow.innerHTML=templateRow;
                    newRow.id=data[row].id;
                    //console.log (newRow.cells[0].firstElementChild);
                    var newStart=newRow.cells[0].firstElementChild;
                    newStart.className="sch"+data[row].id;
                    newStart.value=data[row].start;
                    //newStart.onchange=submitData("schedules", "start", data[row].id, data[row].type, data[row].dev_id);
                    newStart.setAttribute("onchange", 'submitData("schedules", "start", ' + data[row].id+ ', "' + data[row].type +'", ' + data[row].dev_id+ ')');
                    var newStop=newRow.cells[1].firstElementChild;
                    newStop.className="sch"+data[row].id;
                    newStop.value=data[row].stop;
                    //newStop.onchange=submitData("schedules", "stop", data[row].id, data[row].type, data[row].dev_id);
                    newStop.setAttribute("onchange", 'submitData("schedules", "stop", '+ data[row].id+',  "' + data[row].type+'", '+ data[row].dev_id+')');
                    var newState=newRow.cells[2].firstElementChild;
                    newState.className="sch"+data[row].id;
                    newState.value=!data[row].state;
                    newState.indeterminate = false;
                    newState.checked=data[row].state;
                    //newStop.onchange=submitData("schedules", "state", data[row].id, data[row].type, data[row].dev_id);
                    newState.setAttribute("onchange", 'submitData("schedules", "state", ' +data[row].id+', "'+data[row].type+'", '+data[row].dev_id+')');

                    var newDelete=newRow.cells[3].firstElementChild;
                    newDelete.classList.add("sch"+data[row].id);
                    newDelete.setAttribute("onclick", "deleteSchedule("+data[row].id +" )");

                }


        } else if (tabData == "parameters") {


            for (row in data) {
                var element= document.getElementsByName(data[row].name) [0];

                 if (type == "switch") {

                     var element= document.getElementsByName(data[row].name) [0];
                     if(!element){
                         return;
                     }
                     element.indeterminate=false;
                     element.checked = data[row].value;
                     element.value= Number(!data[row].value);
                     showIcon( data[row].name, data[row].value);

                } else if (type == "ui") {
                    element.value = data[row].value;

                } else if (type=="telemetry"){
                     telemetry[row]=data[row].value;
                     drawChart();
                 }
            }

        } else if (tabData == "devices") {
                var dev_list= document.getElementById("device_list");
                dev_list.innerHTML="";
            for (row in data) {
                dev_list.innerHTML+= '<a class="dropdown-item" role="presentation" style="padding:0px;"><button class="btn btn-light" type="button" onclick="loadDevice('+ data[row].id + ')" style="width:156px;background-color:rgba(0,0,0,0);color:#296333;margin:2px;">' +data[row].name+ '</button></a>'
            }
            if(firstRun){
                //console.log(data);
                loadDevice(data[0].id);
            }
        }


        }

        else if(this.readyState==4 &&this.status == 401) {
            window.location.replace("/login.html");
        }
    };
    xmlhttp.open("GET", "fetch?table=" +tabData+ "&device="+ device +"&type="+ type + "&order="+order, true);
    xmlhttp.setRequestHeader("authorization", "bearer " + sessionStorage.getItem("token"));
    xmlhttp.send();
}


function loadDevice(id){

    if (window.XMLHttpRequest) {
        xmlhttp = new XMLHttpRequest();
    } else {
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var response=JSON.parse(this.response)[0];
            if (!response.state) {
                alert("Zariadenie je offline!");
            }
            var inputs = document.getElementsByTagName("input");
            for (i in inputs){
                inputs[i].disabled= (!response.state);
            }
            var buttons= document.getElementsByName("button");
            for (b in buttons) {
                buttons[b].disabled = (!response.state);
            }
            showIcon("offline", (!response.state));
            dev_id=id;
            document.getElementsByTagName("h1")[0].innerText=response.name;
            refresh("UI", "parameters", "ui");
            refresh("Switches", "parameters", "switch");
            refresh('schedules-w', 'schedules', 'watering');
            refresh('schedules-v', 'schedules', 'ventilation');
            refresh("Telemetry", "parameters", "telemetry");


        } else if (this.readyState == 4 && this.status != 200) {
            window.location.replace("/login.html");
        }
    };
    xmlhttp.open("GET", "fetch?table=devices" + "&device="+ id,  true);
    xmlhttp.setRequestHeader("authorization", "bearer " + sessionStorage.getItem("token"));
    xmlhttp.send();

}

//submitData("schedules", "state", data[row].id, data[row].type, data[row].dev_id)
function submitData(tabData, elementId, tableId, type="none", device=dev_id){
    //console.log(elementId);
    var elements=document.getElementsByName(elementId);
    //console.log(elements);
    var element=elements[0];
    var name = type;
    if (tabData=="schedules"){
        //var elements=document.getElementsByClassName("sch"+tableId);
        for (var e in elements){
            //console.log(elements[e].className);
            if (elements[e].className=="sch"+tableId){
                element=elements[e]
            }
        }
        name = element.name;
    }
    //var id= Number(element.name.match(/\d+/g));
    //var name = String(element.name.match(/[a-zA-Z]+/g));

    if (name=="start" || name == "stop"){
        element.value+=":00"
    }

    //if ((name=="state") || (name =="switch")){
    if (element.type=="checkbox"){
        element.indeterminate = true;
        element.disabled=true;
    }


    var message = {"action":"update", "table": tabData, "device": device, "id":tableId, "name":name, "value": element.value, "type":type, "token":sessionStorage.getItem("token")}
    ws.send(JSON.stringify(message));
    //console.log(JSON.stringify(message));



}


function newSchedule(tabName) {
    var table=document.getElementById(tabName);
    var rowCount= table.rows.length;
    if (tabName=="schedules-w"){
        var parType="watering";
        var parId =3;
    } else if(tabName=="schedules-v"){
        var parType="ventilation";
        var parId=5;
    }
    var template=table.rows[1].innerHTML;

    var newRow=table.insertRow(-1);
    newRow.innerHTML=template;

    for (var i=0; i < newRow.cells.length; i++){
        newRow.cells[i].firstElementChild.id= "new" + newRow.cells[i].firstElementChild.name + rowCount;
        newRow.cells[i].firstElementChild.removeAttribute("onchange");
    }
    var saveButton=newRow.cells[newRow.cells.length-1].firstElementChild;
    saveButton.setAttribute("onclick", "saveSchedule(\""+ parType +"\", " + rowCount +", "+parId+ ")")
    saveButton.firstElementChild.className="fa fa-floppy-o";
    //saveButton.firstElementChild.className="far fa-save";
}

function saveSchedule(parType, inRow, parId, device=dev_id){
    start = document.getElementById("newstart"+inRow).value+":00";
    stop = document.getElementById("newstop"+inRow).value+":00";
    state = document.getElementById("newstate"+inRow).checked;


    var message = {"action": "insert_schedule", "start":start, "stop":stop, "state": state, "type": parType, "device":device, "par_id":parId};
    ws.send(JSON.stringify(message));

}


function deleteSchedule(sched_id){
    if(confirm("Naozaj chcete natrvalo odstrániť tento plán?")===false){
        return;
    }
    var message = {"action": "delete_schedule", "id":sched_id};
    ws.send(JSON.stringify(message));
}

function showIcon(name, value, logic=false){
    if (logic===false){
        var icon=document.getElementById(name+"Icon");
        if (icon) {
            if (value) {
                icon.style.visibility = "visible"
            } else {
                icon.style.visibility = "hidden"
            }
        }

    }
}
function displayUser(){

    var token = sessionStorage.getItem("token")
    var payload = JSON.parse(window.atob(token.split('.')[1]));
    var user = payload.user.name;
    document.getElementById("username").innerText=user;
}




/*function jwtDecode(t) {
    let token = {};
    token.raw = t;
    token.header = JSON.parse(window.atob(t.split('.')[0]));
    token.payload = JSON.parse(window.atob(t.split('.')[1]));
    return (token)
}*/


//const ws = new WebSocket('ws://localhost:3000', 'echo-protocol');
//var ws = new WebSocket('wss://greenhouse.makers.sk', 'echo-protocol');
var ws;
var lastMessage=new Date();
function timeout(time){
    if (lastMessage < new Date( Date.now() - 1000 * 30) ){
        ws.close();
        alert("Disconnected, try reloading the page");
        location.reload();
    }
    setTimeout(function(){timeout(time)}, time);
}

function hTimeout(time){
    refreshHistory();
    setTimeout(function(){hTimeout(time)}, time);
}

//var telemetry = {"temperature":20, "humidity":54, "soil_hum":70, "light":60, "out_temp":20, "pressure":1000, "rain":0};
var telemetry= [20, 54, 72, 61, 22, 1010, 6];


function drawChart() {

    var t_data = google.visualization.arrayToDataTable([
        ['Label', 'Value'],
        ['Vnútorná teplota', 25]
    ]);

    var h_data = google.visualization.arrayToDataTable([
        ['Label', 'Value'],
        ['Vnútorná vlhkosť', 50]
    ]);

    var sh_data = google.visualization.arrayToDataTable([
        ['Label', 'Value'],
        ['Vlhkosť pôdy', 70]
    ]);

    var l_data = google.visualization.arrayToDataTable([
        ['Label', 'Value'],
        ['svetlo', 60]
    ]);

    var ot_data = google.visualization.arrayToDataTable([
        ['Label', 'Value'],
        ['Vonkajšia teplota', 20]
    ]);
    var p_data = google.visualization.arrayToDataTable([
        ['Label', 'Value'],
        ['tlak', 1000]
    ]);
    var r_data = google.visualization.arrayToDataTable([
        ['Label', 'Value'],
        ['dazd', 0]
    ]);

    var t_options = {
        width: 160, height: 160,
        redFrom: 30, redTo: 60,
        minorTicks: 10, min: 10, max: 60,
        majorTicks: ["10", "20", "30", "40", "50", "60"]
    };

    var h_options = {
        width: 160, height: 160,
        redFrom: 80, redTo: 100,
        yellowFrom: 0, yellowTo: 20,
        minorTicks: 4,
        min: 0, max: 100,
        majorTicks: ["0", "20", "40", "60", "80", "100"]
    };
    var sh_options = {
        width: 160, height: 160,
        redFrom: 90, redTo: 100,
        yellowFrom: 0, yellowTo: 40,
        minorTicks: 4,
        min: 0, max: 100,
        majorTicks: ["0", "20", "40", "60", "80", "100"]
    };
    var l_options = {
        width: 120, height: 120,
        redFrom: 0, redTo: 40,
        yellowFrom: 40, yellowTo: 80,
        minorTicks: 5,
        min: 0, max: 100,
        majorTicks: ["0", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100"]
    };
    var ot_options = {
        width: 120, height: 120,
        redFrom: 0, redTo: 40,
        yellowFrom: 40, yellowTo: 80,
        minorTicks: 5,
        min: 0, max: 100,
        majorTicks: ["0", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100"]
    };
    var p_options = {
        width: 120, height: 120,
        redFrom: 0, redTo: 40,
        yellowFrom: 40, yellowTo: 80,
        minorTicks: 5,
        min: 950, max: 1050,
        majorTicks: ["950", "970", "990", "1010", "1030", "1050"]
    };
    var r_options = {
        width: 120, height: 120,
        redFrom: 0, redTo: 40,
        yellowFrom: 40, yellowTo: 80,
        minorTicks: 5,
        min: 0, max: 100,
        majorTicks: ["0", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100"]
    };

    var t_chart = new google.visualization.Gauge(document.getElementById('temp_gauge'));
    var h_chart = new google.visualization.Gauge(document.getElementById('hum_gauge'));
    var sh_chart = new google.visualization.Gauge(document.getElementById('shum_gauge'));
    var l_chart = new google.visualization.Gauge(document.getElementById('light_gauge'));
    var ot_chart = new google.visualization.Gauge(document.getElementById('ot_gauge'));
    var p_chart = new google.visualization.Gauge(document.getElementById('pres_gauge'));
    var r_chart = new google.visualization.Gauge(document.getElementById('rain_gauge'));


    t_data.setValue(0, 1, telemetry[0]);
    h_data.setValue(0, 1, telemetry[1]);
    sh_data.setValue(0, 1, telemetry[2]);
    l_data.setValue(0, 1, telemetry[3]);
    ot_data.setValue(0, 1, telemetry[4]);
    p_data.setValue(0, 1, telemetry[5]);
    r_data.setValue(0, 1, telemetry[6]);




    t_chart.draw(t_data, t_options);
    h_chart.draw(h_data, h_options);
    sh_chart.draw(sh_data, sh_options);
    l_chart.draw(l_data, l_options);
    ot_chart.draw(ot_data, ot_options);
    p_chart.draw(p_data, p_options);
    r_chart.draw(r_data, r_options);

}

var historyData = [
    ["1",  20, 50, 70, 60, 20, 1000, 0],
    ["2",  25, 55, 65, 30, 20, 1010, 10]
    ];


function drawHistoryChart() {

        var data = new google.visualization.DataTable();
        data.addColumn('string', 'time');
        data.addColumn('number', 'Vnútorná teplota');
        data.addColumn('number', 'Vlhkosť vzduchu');
        data.addColumn('number', 'Vlhkosť pôdy');
        data.addColumn('number', 'Intenzita svetla');
        data.addColumn('number', 'Vonkajšia teplota');
        data.addColumn('number', 'Atmosferický tlak');
        data.addColumn('number', 'Dážď');

        data.addRows(
           historyData
        );

        var options = {
            chart: {
                //title: 'Box Office Earnings in First Two Weeks of Opening',
                //subtitle: 'in millions of dollars (USD)'
            },
            legend: {
                position:"bottom"
            },

            series: {
                0: {targetAxisIndex: 0},
                1: {targetAxisIndex: 0},
                2: {targetAxisIndex: 0},
                3: {targetAxisIndex: 0},
                4: {targetAxisIndex: 0},
                5: {targetAxisIndex: 2},
                6: {targetAxisIndex: 0}
            },

            vAxes: {
                // Adds labels to each axis; they don't have to match the axis names.
                    1: {label:'°C'},
                    0:{label: '%'},
                    2:{label: 'hPa'}

            }




            };

        var chart = new google.visualization.LineChart(document.getElementById('history_chart'));


        //var chart = new google.charts.Line(document.getElementById('history_chart'));

    chart.draw(data, options);

}



function changeSize(elentId){
    var element=document.getElementById(elentId);
    var child =document.getElementById("history_chart");
    console.log(child);
    var currentSize = element.classList[1];

    var width =  Number(element.offsetWidth);
    var height = Number(element.offsetHeight);

    var cheight= Number(element.offsetHeight);
    const n=3;

    if (currentSize==="small"){
        //element.setAttribute("style", "padding:15px;min-width:" + width*2 +"px; min-height:" + height*2 + "px");
        element.style.minWidth=width*n+"px";
        element.style.minHeight=height*n+"px";
        element.parentElement.style.minWidth=width*n+"px";
        element.parentElement.style.minHeight=height*n+"px";
        element.parentElement.parentElement.style.minWidth=width*n+"px";
        element.parentElement.parentElement.style.minHeight=height*n+"px";

        child.style.maxHeight=cheight*n+"px"


        element.classList.add("big");
        element.classList.remove("small");

    } else if (currentSize=== "big"){
        element.style.minWidth=width/n+"px";
        element.style.minHeight=height/n+"px";
        element.parentElement.style.minWidth=width/n+"px";
        element.parentElement.style.minHeight=height/n+"px";
        element.parentElement.parentElement.style.minWidth=width/n+"px";
        element.parentElement.parentElement.style.minHeight=height/n+"px";

        child.style.maxHeight="170px"

        element.classList.remove("big");
        element.classList.add("small");
    }

    drawHistoryChart()

}

function refreshHistory() {

    var date=document.getElementById("h_date").value;
    date+=" " + new Date().toISOString().split("T")[1];


    if (window.XMLHttpRequest) {
        xmlhttp = new XMLHttpRequest();
    } else {
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var response=JSON.parse(this.response);
            historyData = [];
            var firstTime =0;
            if (response.length > 0) {
                firstTime = response[0].hour;
            }

            for (var i=0; i<24; i++){
                historyData.push([(i+firstTime)%24+":00",0,0,0,0,0,0,0]);
            }
            for(var row in response){
                var data=response[row];
                historyData[(data.hour-firstTime+24)%24][data.par_id]=Number(data.round);
            }
            drawHistoryChart();


        } else if (this.readyState == 4 && this.status != 200) {
            console.log(this.response);

        }
    };
    xmlhttp.open("GET", "history?date="+date , true);
    //xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xmlhttp.send();
}