var http = require('http');
var url = require('url');
const httpParse= require('querystring');
var fs = require('fs');
var WebSocketServer = require('websocket').server;
const jwt = require('jsonwebtoken');
const secretkey="4hQiYoT9ReK0XYoCGdtFvQ9A3T3snHKW";
const crypto = require('crypto');
const express = require('express');
const bodyParser= require("body-parser");

const {Pool, Client} = require('pg');


var app = express();

app.use(express.static("Page"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


app.post("/sign_in", function(req, res){
    var data = req.body;
    console.log(data);
    console.log(req.body.login);


    var queryString= "SELECT * FROM users WHERE name= '"+ data.login+"'";
    client2.query(queryString, function(err, result) {

        if (err || result.rows.length===0) {
            res.writeHead(403, {'Content-Type': 'text/plain'});
            res.end("Nesprávne meno používateľa alebo heslo");
        }
        else {
            const passHash = crypto.createHmac('sha256', secretkey)
                .update(data.password)
                .digest('hex');

            if (passHash === result.rows[0].password){
                var user= { "name": data.login, "privileges":result.rows[0].privileges,
                    "responsible":result.rows[0].responsible};

                jwt.sign({"user": user}, secretkey, {"expiresIn": data.expires}, function(err, token){
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({"token": token}));
                });

            }
            else {
                res.writeHead(403, {'Content-Type': 'text/plain'});
                res.end("Nesprávne meno používateľa alebo heslo");
            }
        }
    });
});

app.get("/fetch", function(req, res){
    const token=getToken(req);
    var user={};
    try{
        user=jwt.verify(token, secretkey).user;
    }
    catch (err) {
        res.writeHead(401, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({"status": 401, "message": "Unauthorized", "description":err.message}));
        console.log(err.message);
        return;
    }

    res.writeHead(200, {'Content-Type': 'application/json'});
    var columns='*';
    var table=req.query.table;
    var condition='';
    var order='';

    if (req.query.device!='null') {
        if (table == "devices") {
            condition = ' WHERE id = ' + req.query.device;
        } else {
            condition = ' WHERE dev_id = ' + req.query.device;
        }
    }
    if (req.query.type){
        if (condition == ''){
            condition= " WHERE type = '" + req.query.type + "'";
        } else {
            condition += " AND type = '" + req.query.type+ "'";
        }
    }
    if (req.query.order){
        order= ' ORDER BY '+ req.query.order;
    }


    var queryString= 'SELECT ' + columns + ' FROM ' + table + condition + order;

    // noinspection BadExpressionStatementJS
    client2.query(queryString, function(err, result) {

        if (err) {
            res.write(JSON.stringify({"success":false, "query":queryString, "error":err.stack}));
            res.end();
        }
        else {
            res.end(JSON.stringify(result.rows))
        }
    });


});

app.get("/history", function (req, res) {

    var utcdate= new Date(req.query.date);
    var date=new Date(utcdate-utcdate.getTimezoneOffset()*60*1000);

    var queryString = "SELECT name, par_id, round(avg(value)::numeric,2), extract(hour from timestamp) as hour, extract(day from timestamp) as day " +
        "from history WHERE par_id< 8 and timestamp between timestamp '"+ date.toISOString() +"'- interval '24 hours' and '" + date.toISOString() + "'"+
        " GROUP BY extract(hour from timestamp), extract(day from timestamp)," +
        " par_id, name order by extract(day from timestamp), extract(hour from timestamp), par_id";

    client2.query(queryString, function (err, result) {
        if (err) {
            res.writeHead(422);
            res.write(JSON.stringify({"success": false, "query": queryString, "error": err.stack}));
            res.end();
        } else {
            res.json(result.rows);
        }
    });

});


const server = app.listen(3000, function () {
});


var count = 0;
var clients = [];


const mqtt = require('mqtt');

//const mqttClient = mqtt.connect("mqtt://test.mosquitto.org");
const last_will={
    "topic":"greenhouse/error",
    "payload": JSON.stringify({"type": "server_off", "timestamp ": new Date()})
}
const mqttClient = mqtt.connect("tcp://m24.cloudmqtt.com",{"port":18220, "clientId":"Server", "username":"jzlgxdzd", "password":"wu_hYC-iCtIB", "will":last_will});

mqttClient.on('connect', function() {

    console.log("mqtt connected");

mqttClient.publish('greenhouse/test', "Hello");
mqttClient.subscribe('greenhouse/test');
mqttClient.subscribe('greenhouse/data');
mqttClient.subscribe('greenhouse/disconnect');
mqttClient.subscribe('greenhouse/error');
mqttClient.subscribe('greenhouse/camera');
});




var client2 = new Client({
        user: 'postgres',
        host: 'earth.makers.sk',
        database: 'postgres',
        password: 'WcIlh5rQPpu8AE',
        port: 5432
    });

client2.connect();

mqttClient.on('message', function(topic, message) {

    if(topic==="greenhouse/data" ){
        data=JSON.parse(message);
        //console.log (JSON.stringify(data))
        var querystring="";
        for (row in data) {
            //console.log(data[row]);
            querystring="UPDATE parameters SET value="+data[row].value+ ", timestamp='"+data[row].timestamp+"'"+
                " WHERE id="+data[row].id+" AND dev_id="+data[row].dev_id;
            //console.log(querystring);
            client2.query(querystring);


            querystring="INSERT INTO history ( name, value, timestamp, par_id, dev_id ) " +
                "VALUES ('"+data[row].name+"', "+data[row].value +", '"+data[row].timestamp+"'," +
                " "+data[row].id+", " +data[row].dev_id+" )";
            //console.log(querystring);
            client2.query(querystring);
        }
        date=new Date(data[0].timestamp);
        date.setDate(date.getDate()-7);
        client2.query("DELETE from history WHERE timestamp < '"+date.toISOString()+"'");
        //console.log(date-1000)

        querystring="UPDATE devices SET created='"+data[0].timestamp+ "', state=true WHERE id="+data[0].dev_id;
        //console.log(querystring)
        client2.query((querystring));

        for(var i in clients){
            clients[i].sendUTF(JSON.stringify({"command":"refresh", "dev_id":data[0].dev_id }));
        }
    }
    else if(topic=="greenhouse/test"){

        querystring= "SELECT * FROM schedules ORDER BY id";
        client2.query(querystring,function(err, result){

            if (err) {
                console.log(JSON.stringify({"success":false, "query":querystring, "error":err.stack}));
            }
            else {
                mqttClient.publish('greenhouse/schedules',JSON.stringify(result.rows) );
        }
    });

    }
    else if(topic=="greenhouse/disconnect"){
    data=JSON.parse(message);
    console.log(data);
    querystring="UPDATE devices SET created='"+data.timestamp+ "', state='false' WHERE id="+data.dev_id;
    client2.query(querystring);
    }
    else if (topic=="greenhouse/camera"){

        pChunk = JSON.parse(message);

        //creates a new picture object if receiving a new picture, else adds incoming strings to an existing picture
        if (pictures[pChunk["pic_id"]] == null) {
            pictures[pChunk["pic_id"]] = {"count": 0, "total": pChunk["size"], pieces: {}, "pic_id": pChunk["pic_id"]};

            pictures[pChunk["pic_id"]].pieces[pChunk["pos"]] = pChunk["data"];

        } else {
            pictures[pChunk["pic_id"]].pieces[pChunk["pos"]] = pChunk["data"];
            pictures[pChunk["pic_id"]].count += 1;


            if (pictures[pChunk["pic_id"]].count == pictures[pChunk["pic_id"]].total) {
                console.log("Image reception compelete");
                var str_image = "";

                for (var i = 0; i <= pictures[pChunk["pic_id"]].total; i++)
                    str_image = str_image + pictures[pChunk["pic_id"]].pieces[i];
                console.log(str_image);

                for(var i in clients){
                    clients[i].sendUTF(JSON.stringify({"command":"camera", "dev_id":1, "image":str_image }));
                }
            }
        }

    }
    else if (topic=="greenhouse/error"){

        var data=JSON.parse(message);
        data.push({"command": "error"});
        for(var i in clients){
            clients[i].sendUTF(JSON.stringify(data));
        }

    }
});

var pictures= [];



/* const oldserver = http.createServer(function (req, res) {


    var q = url.parse(req.url, true);
    var qdata=q.query;


    if (q.pathname=="/fetch") {
        const token=getToken(req);
        /*if (!token){
            res.writeHead(401, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({"status": 401, "message":"Unauthorized"}));
            return;

        var user={};
        try{
            user=jwt.verify(token, secretkey).user;
        }
        catch (err) {
            res.writeHead(401, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({"status": 401, "message": "Unauthorized", "description":err.message}));
            console.log(err.message);
            return;
        }
        //console.log(user);
        res.writeHead(200, {'Content-Type': 'application/json'});
        var columns='*';
        var table=qdata.table;
        var condition='';
        var order='';
        
        if (qdata.device!='null'){
            condition= ' WHERE dev_id = ' + qdata.device;
        }
        if (qdata.type){
            if (condition == ''){
                condition= " WHERE type = '" + qdata.type + "'";
            } else {
                condition += " AND type = '" + qdata.type+ "'";
            }
        }
        if (qdata.order){
            order= ' ORDER BY '+ qdata.order;
        }
       
        
        var queryString= 'SELECT ' + columns + ' FROM ' + table + condition + order;
        
        // noinspection BadExpressionStatementJS
        client2.query(queryString, function(err, result) {

            if (err) {
                res.write(JSON.stringify({"success":false, "query":queryString, "error":err.stack}));
                res.end();
            }
            else {
                res.end(JSON.stringify(result.rows))
            }
        });
     
    }
    else if (q.pathname=="/"){
        fs.readFile('index.html', function (err, data) {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.write(data);
            res.end();
        });
    }
    else if (q.pathname=="/login"){
        fs.readFile('login.html', function (err, data) {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.write(data);
            res.end();
        });
    }
    else if (q.pathname=="/sign_in"){
        var user= {
            "id":1,
            "username": "user",
            "password": "password",
        };
        if (req.method=='POST'){
            var body = '';
            req.on('data', function(chunk) {
                body += chunk;
            });
            req.on('end', function() {
                var data = httpParse.parse(body);
                var queryString= "SELECT * FROM users WHERE name= '"+ data.login+"'";
                client2.query(queryString, function(err, result) {

                    if (err || result.rows.length===0) {
                        res.writeHead(403, {'Content-Type': 'text/plain'});
                        res.end("Nesprávne meno používateľa alebo heslo");
                    }
                    else {
                        const passHash = crypto.createHmac('sha256', secretkey)
                            .update(data.password)
                            .digest('hex');

                        if (passHash == result.rows[0].password){
                            var user= { "name": data.login, "privileges":result.rows[0].privileges, "responsible":result.rows[0].responsible};

                            jwt.sign({"user": user}, secretkey, {"expiresIn": data.expires}, function(err, token){
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                res.end(JSON.stringify({"token": token}));
                            });

                        }
                        else {
                            res.writeHead(403, {'Content-Type': 'text/plain'});
                            res.end("Nesprávne meno používateľa alebo heslo");
                        }
                    }
                });
            });
        }

    }
    /*else{
        res.writeHead(404, {'Content-Type': 'text/html'});
        res.write("<h1> NOT FOUND </h1> <a href='/'> Return home </a>");
        res.end();
    }
});
oldserver.listen(7000);*/



function getToken(req){
    var bearer=req.headers.authorization;
    if (bearer){
        return bearer.split(" ")[1];
    }
}

const wsServer = new WebSocketServer({
    httpServer: server
});




wsServer.on('request', function(r){
    var connection = r.accept('echo-protocol', r.origin);
    var id = count++;
    clients[id] = connection;
    console.log("connection made");

    connection.on('message', function(message) {
        var msgString = message.utf8Data;
        console.log(msgString);

        var data = JSON.parse(msgString);
        var queryString=null;

        /*try{
            jwt.verify(data.token, secretkey);
        }
        catch (err) {
            console.log(err.message);
            return;
        }*/


        if (data.action == "update"){
            mqttClient.publish("greenhouse/commands", JSON.stringify({"id":data.id, "table":data.table, "type":data.name, "value":data.value, "schedule":data.type}));

            if (data.table=="schedules"){
                queryString= "UPDATE "+ data.table + " SET "+ data.name + "= '" + data.value + "' WHERE id = "+ data.id;

            }
            if (data.name=="ui"){


                queryString= "UPDATE "+ data.table + " SET value = " + data.value + " WHERE id = "+ data.id;
            }
        }
        else if (data.action=="delete_schedule"){
            queryString="DELETE from schedules WHERE id="+data.id;

        }
        else if (data.action=="insert_schedule"){
            queryString="INSERT INTO schedules ( type, start, stop, state, dev_id, par_id ) " +
                "VALUES ( '"+ data.type +"', '"+ data.start + "', '"+ data.stop +"', "+ data.state + ", "+data.device+", "+ data.par_id+ " )";
        }

        if (!queryString){
            return;
        }
        console.log(queryString);
        client2.query(queryString, function(err, result){

            if (err) {
                console.error(err.stack);
            }
            else {
                for(var i in clients){
                    clients[i].sendUTF(JSON.stringify({"command":"refresh", "dev_id":data.device}));
                }
            }
        });


    });

    connection.on('close', function(reasonCode, description) {
        delete clients[id];
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });

});

function timeout(time){
    for(var i in clients){
        clients[i].sendUTF(JSON.stringify({"heartbeat":"true"}));
    }
    setTimeout(function(){timeout(time)}, time);
}
timeout(25000)
