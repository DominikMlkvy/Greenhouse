#!/usr/bin/python
# coding=utf-8
import sys
import Adafruit_DHT
# import paho.mqtt.publish as publish
import json
import time
import datetime
import base64
import random, string, math
import paho.mqtt.client as mqtt
import copy
import relay
import database
from multiprocessing import Process

import RPi.GPIO as GPIO
import os

import sys, os.path
import PCF8591 as ADC

from picamera import PiCamera

bmp_dir = (os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
           + '/Adafruit-Raspberry-Pi-Python-Code/Adafruit_BMP085/')
sys.path.append(bmp_dir)
from Adafruit_BMP085 import BMP085

path = '/home/pi/Program/greenhouse/Data/device_data.db'
#path = 'Data/device_data.db'

broker = "m24.cloudmqtt.com"
port = 18220
user = "jzlgxdzd"
password = "wu_hYC-iCtIB"

last_watering = datetime.datetime.strptime("00:00:01", "%H:%M:%S")


# ids of items after selecting them from database
switch_ids = {
        "heating": 0,
        "watering": 1,
        "lighting": 2,
        "ventilation": 3,
    }
ui_ids = {
    "d_temp": 0,
    "d_hum": 1,
    "s_hum_l": 2,
    "s_hum_h": 3,
    "vent_t_l": 4,
    "w_duration": 5,
    "w_cooldown": 6
}

tel_ids = {
    "temperature": 0,
    "humidity": 1,
    "soil_hum": 2,
    "light": 3,
    "out_temp": 4,
    "pressure": 5,
    "rain": 6
}



def telemetryLoop():
    bmp = BMP085(0x77)
    ADC.setup(0x48)
    ids = {
        "temperature": 0,
        "humidity": 1,
        "soil_hum": 2,
        "light": 3,
        "out_temp": 4,
        "pressure": 5,
        "rain": 6
    }
    try:

        while True:

            #count = database.elementsCount(path, "parameters", "WHERE type='telemetry'")

            # ====================================Measuring===========================================

            #get the last telemetry value from database and make a copy
            telemetry = database.selectMultiple(path, "parameters", "*", "WHERE type='telemetry'")
            telnew = copy.deepcopy(telemetry)


            #do the measuring and store results in the telemetry copy
            telnew[1]["value"], telnew[0]["value"] = Adafruit_DHT.read_retry(11, 18)
            telnew[4]["value"] = bmp.readTemperature()
            telnew[5]["value"] = bmp.readPressure() / 100
            # altitude = bmp.readAltitude(101900) #1019 hPa is default pressure for Trnava

            telnew[ids["light"]]["value"] = round_float(100 - ADC.read(0) / 255.0 * 100, 2)
            telnew[ids["soil_hum"]]["value"] = round_float(100 - ADC.read(1) / 255.0 * 100, 2)
            telnew[ids["rain"]]["value"] = round_float(100 - ADC.read(2) / 255.0 * 100, 2)

            """
            print "##############################################"
            print "new - ", sorted(telnew[0].values())
            print "old - ", sorted(telemetry[0].values())
            print "##############################################"
            """
            
            # temperature sensor sometimes fails
            if type(telnew[0]["value"]) != type(int()) and type(telnew[0]["value"]) != type(float()):
                print "DHT11 failed"
                continue
            #===============================STORE AND PUBLISH NEW VALUES===================================
            for i in range(len(telnew)):
                if sorted(telnew[i].values()) != sorted(telemetry[i].values()):
                    publishData([telnew[i]]);
                    database.update(path, "parameters", ["value", "timestamp"],
                                    [float(telnew[i]["value"]), "'" + telnew[i]["timestamp"] + "0'"],
                                    "WHERE id=" + str(telnew[i]["id"]))

    except:
        print "exiting"
        errMessage = {"type": "device_error", "text": "Porucha snímačov", "timestamp": str(datetime.datetime.now()), "device":1 }
        client.publish("greenhouse/error", json.dumps(errMessage), 2, False)


def cameraLoop():
    camera = PiCamera()
    camera_last = 0
    camera_delay = 5
    while True:
        try:
            if time.time() > camera_last + camera_delay:
                print "taking photo"
                #camera.start_preview()
                time.sleep(1)
                #camera.capture('image.jpg', resize=(500, 281))
                #camera.stop_preview()
                camera_last = time.time()
                #camera.close()

                encoded=convertImageToBase64()
                publishEncodedImage(encoded)

        except KeyboardInterrupt:
            print "Camera exit"
            break
        except:
            e = sys.exc_info()[0]
            print "Camera failed"
            print "Error: %s" % e

def actionLoop():
    try:
        while True:
            
                switches = database.selectMultiple(path, "switches", "*")

                for switch in switches:
                    checkSwitch(switch)

                time.sleep(5) # optimal sleep time will be decided later


    except:
        e = sys.exc_info()[0]
        print "Actions failed"
        print "Error: %s" % e
        errMessage = {"type": "device_error", "text": "Porucha vyhodnocovacej logiky alebo akčných členov", "timestamp": str(datetime.datetime.now()),
                      "device": 1}
        client.publish("greenhouse/error", json.dumps(errMessage), 2, False)


def convertImageToBase64():
 with open("image.jpg", "rb") as image_file:
    encoded = base64.b64encode(image_file.read())
 return encoded

def randomword(length):
 return ''.join(random.choice(string.lowercase) for i in range(length))


packet_size=3000


def publishEncodedImage(encoded):
    end = packet_size
    start = 0
    length = len(encoded)
    picId = randomword(8)
    pos = 0
    no_of_packets = math.ceil(length / packet_size)

    while start <= len(encoded):
        data = {"data": encoded[start:end], "pic_id": picId, "pos": pos, "size": no_of_packets}
    client.publish("greenhouse/camera", json.dumps(data))
    end += packet_size
    start += packet_size
    pos = pos + 1



def checkSwitch(switch, fromUser=False):

    # ===================================Machine logic=============================================
    switch_types={
        "heating":[8],
        "watering":[9],
        "lighting":[10],
        "ventilation":[11],
    }
    now = datetime.datetime.now()
    #now= datetime.datetime.strptime("2019-02-12 07:50:00.000001", "%Y-%m-%d %H:%M:%S.%f")
    timestamp = str(now)
    ui = database.selectMultiple(path, "parameters", "*", "WHERE type='ui'")
    telemetry = database.selectMultiple(path, "parameters", "*", "WHERE type='telemetry'")

    # ---------------------------------Heating------------------------------------
    if int(switch["id"]) in switch_types["heating"]:

        # if desired temperature is higher than real, heating turns on, if its lower, it turns off
        if ui[ui_ids["d_temp"]]["value"] > telemetry[tel_ids["temperature"]]["value"]:
            switch["value"] = 1

        elif ui[ui_ids["d_temp"]]["value"] < telemetry[tel_ids["temperature"]]["value"]:
            switch["value"]= 0

    # --------------------------------Watering--------------------------------------
    elif int(switch["id"]) in switch_types["watering"]:
        # first resolve manual cycles, they can be later overwritten by schedules

        # firstly check if soil humidity isn´t below low threshold
        if telemetry[tel_ids["soil_hum"]]["value"] < ui[ui_ids["s_hum_l"]]["value"]:
            switch["value"]=1
            #switches[switch_ids["watering"]]["value"] = 1

        # then check if watering was started either by low soil humidity or by user, if yes, check watering cooldown
        if switch["value"] == 1:
            global last_watering
            duration = datetime.timedelta(minutes=float(ui[ui_ids["w_duration"]]["value"]))
            cooldown = datetime.timedelta(hours=float(ui[ui_ids["w_cooldown"]]["value"]))
            if now > last_watering + cooldown:
                # watering is after cooldown, manual cycle can be started
                last_watering = now
            elif now < last_watering + cooldown and now > last_watering + duration:
                # watering is in cooldown, manual cycle is denied
                switch["value"]=0
                #switches[switch_ids["watering"]]["value"] = 0
            elif now < last_watering + duration:
                # watering is under way, there shouldn't be a change in watering state
                pass
            else:
                print "manual watering error: time is out of interval"

        # now resolve scheduled watering
        schedules = database.selectMultiple(path, "schedules", "*", "WHERE type='watering' AND state=1")
        dt, tm = timestamp.split()
        tm, milis= tm.split(".")

        time_now = datetime.datetime.strptime(tm, "%H:%M:%S")
        for schedule in schedules:
            start = datetime.datetime.strptime(schedule["start"], "%H:%M:%S")
            stop = datetime.datetime.strptime(schedule["stop"], "%H:%M:%S")
            if time_now < start:
                # schedule have not started yet, watering in manual mode
                pass
            elif time_now > start and time_now < stop:
                # scheduled watering is running
                switch["value"] = 1
                #switches[switch_ids["watering"]]["value"] = 1
            elif time_now > stop and time_now < stop + datetime.timedelta(minutes=1):
                # scheduled watering just ended, turning it off
                switch["value"] = 0
                #switches[switch_ids["watering"]]["value"] = 0
            elif time_now > stop + datetime.timedelta(minutes=1):
                # scheduled watering has ended, watering in manual mode
                pass
            else:
                print "scheduled watering error: time is out of interval"

        # lastly check if soil humidity is not over high threshold, this overwrites everything
        if telemetry[tel_ids["soil_hum"]]["value"] > ui[ui_ids["s_hum_h"]]["value"]:
            switch["value"]=0
            switches[switch_ids["watering"]]["value"] = 0

    # ------------------------------------Ventilation---------------------------------------


    elif int(switch["id"]) in switch_types["ventilation"]:
        # 13. 2. "will be implemented later"
        schedules = database.selectMultiple(path, "schedules", "*", "WHERE type='ventilation' AND state=1")
        dt, tm = timestamp.split()
        tm, milis = tm.split(".")

        # first resolve scheduled ventilation, it can be overwritten
        time_now = datetime.datetime.strptime(tm, "%H:%M:%S")
        for schedule in schedules:
            start = datetime.datetime.strptime(schedule["start"], "%H:%M:%S")
            stop = datetime.datetime.strptime(schedule["stop"], "%H:%M:%S")
            if time_now < start:
                # schedule did not start yet
                pass
            elif time_now > start and time_now < stop:
                # scheduled ventilation is running
                switch["value"] = 1

            elif time_now > stop and time_now < stop + datetime.timedelta(minutes=1):
                # scheduled ventilation just ended, turning it off
                switch["value"] = 0
            elif time_now > stop + datetime.timedelta(minutes=1):
                # scheduled ventilation has ended, ventilation can be used in manual mode
                pass
            else:
                print "scheduled ventilation error: time is out of interval"

        # now check for conditions with lower priority
        high_temp=10
        high_hum=20
        if float(telemetry[tel_ids["temperature"]]["value"]) > (float(ui[ui_ids["d_temp"]]["value"])+high_temp) or float(telemetry[tel_ids["humidity"]]["value"])>(float(ui[ui_ids["d_hum"]]["value"])+high_hum):
            switch["value"] = 1
        elif float(telemetry[tel_ids["temperature"]]["value"]) < float(ui[ui_ids["d_temp"]]["value"]) or float(telemetry[tel_ids["humidity"]]["value"])<float(ui[ui_ids["d_hum"]]["value"]):
            switch["value"] = 0

        # now check for high priority conditions

        if float(telemetry[tel_ids["out_temp"]]["value"]) < float(ui[ui_ids["vent_t_l"]]["value"]):
            switch["value"] = 0
        if float(telemetry[tel_ids["rain"]]["value"]) > 50:
            switch["value"] = 0



    # ----------------------------------Lighting or other-----------------------------------
    else:
        pass


    # ===============================SAVE AND APPLY CHANGES=================================

    switch["timestamp"] = timestamp
    if switch["value"] != switch["old_value"]:
        relay.switch(int(switch["pin"]), int(switch["value"]) == 1)
        publishData([switch])
        database.update(path, "switches", ["value", "old_value", "timestamp"], [int(switch["value"]), int(switch["value"]), "'" + timestamp + "'"], "WHERE id=" + str(switch["id"]))

        if switch["is_motor"]==True:
            pins = str(switch["motor pins"]).split(",")
            for i in range (len(pins)):
                pins[i] = int(pins[i])
            print pins
            print relay.motor_full(pins, int(switch["value"]) == 1, 90)
    elif fromUser:
        publishData([switch])
        print "Change rejected"



def publishData(data, switch=False):
    timestamp = str(datetime.datetime.now())
    for i in data:
        i["timestamp"] = timestamp
        i["dev_id"] = 1
    client.publish("greenhouse/data", json.dumps(data), 0, False)


def synchronize():
    telemetry = database.selectMultiple(path, "parameters", "*", "WHERE type='telemetry'")
    publishData(telemetry)
    ui = database.selectMultiple(path, "parameters", "*", "WHERE type='ui'")
    publishData(ui)
    switches = database.selectMultiple(path, "switches", "*")
    publishData(switches, True)
    client.publish("greenhouse/test", "refresh schedules")


def on_connect(client, userdata, flags, rc):
    print("Connected with result code " + str(rc))
    client.subscribe("greenhouse/test")
    client.subscribe("greenhouse/commands")
    client.subscribe("greenhouse/schedules")
    synchronize()


def on_message(client, userdata, msg):
    #print(msg.topic + " " + str(msg.payload))

    if msg.payload == "Hello":
        print("Server online")
        synchronize()

    if msg.topic == "greenhouse/schedules":
        database.delete(path, "schedules")
        payload = json.loads(msg.payload)
        for data in payload:
            sch = database.select(path, "schedules", "*", "WHERE id =" + str(data["id"]))
            if sch:
                database.update(path, "schedules", ["type", "start", "stop", "state"],
                                      ["'" + data["type"] + "'", "'" + data["start"] + "'", "'" + data["stop"] + "'",
                                       int(data["state"])], "WHERE id=" + str(data["id"]))

            else:
                if data["type"] == "watering":
                    sw_id = 9
                elif data["type"] == "ventilation":
                    sw_id = 11

                values = "" + str(data["id"]) + ", '" + str(data["type"]) + "', '" + str(data["start"]) + "', '" + str(
                    data["stop"]) + "', " + str(int(data["state"])) + ", " + str(sw_id) + ", " + str(
                    data["par_id"]) + " "
                database.insert(path, "schedules", values)


    elif msg.topic == "greenhouse/commands":
        data = json.loads(msg.payload)
        timestamp = str(datetime.datetime.now())
        if (data["type"] == "switch"):
            table = "switches"
            # switch = database.select('Data/device_data.db', table, "*", "WHERE id ="+ str(data["id"]) )
            switch = database.select(path, table, "*", "WHERE id =" + str(data["id"]))
            switch["value"]=data["value"]
            checkSwitch(switch, True)
            #relay.switch(int(switch["pin"]), (int(data["value"]) == 1))
            return
        else:
            table = str(data["table"])

        if str(data["table"]) == "parameters":
            database.update(path, table, ["value", "timestamp"], [float(data["value"]), "'" + timestamp + "'"],
                                  "WHERE id=" + str(data["id"]))
        elif str(data["table"] == "schedules"):

            sch = database.select(path, table, "*", "WHERE id =" + str(data["id"]))
            if sch:
                if data["type"] == "state":
                    column = int(data["value"] == "true")
                else:
                    column = "'" + str(data["value"]) + "'"
                database.update(path, table, [str(data["type"])], [column], "WHERE id=" + str(data["id"]))
            else:
                client.publish("greenhouse/test", "refresh schedules")


def round_float(number, decimals):
    big = int(number * (10 ** decimals))
    rounded = float(big) / (10 ** decimals)
    return rounded


# Create an MQTT client and attach our routines to it.
client = mqtt.Client("Greenhouse1")
client.username_pw_set(user, password=password)
client.on_connect = on_connect
client.on_message = on_message
client.will_set("greenhouse/disconnect", json.dumps({"dev_id": 1, "timestamp": str(datetime.datetime.now())}), 0, True)

client.connect(broker, port, 300)

switches = database.selectMultiple(path, "switches", "*")
for switch in switches:
    relay.switch(int(switch["pin"]), (int(switch["value"]) == 1))

# client.loop_forever()
#client.loop_start()

# telemetryLoop()

#=====================================Reset, Shutdown, Mannual light buttons===========================================

GPIO.setmode(GPIO.BCM)
GPIO.setup(8, GPIO.IN, pull_up_down = GPIO.PUD_DOWN)
GPIO.setup(7, GPIO.IN, pull_up_down = GPIO.PUD_DOWN)
GPIO.setup(5, GPIO.IN, pull_up_down = GPIO.PUD_DOWN)

path = '/home/pi/Program/greenhouse/Data/device_data.db'
#path = 'Data/device_data.db'


def Shutdown(channel):
    os.system("sudo shutdown now")
    print "Shutdown button pressed, shutting down"
def Restart(channel):
    print "Reset button pressed, restarting"
    os.system("sudo reboot")

def Light(channel):
    light = database.select(path, "switches", "*", "WHERE name='lighting'")
    light["value"] = int(not light["value"])
    checkSwitch(light, True)


GPIO.add_event_detect(8, GPIO.RISING, callback = Shutdown, bouncetime = 2000)
GPIO.add_event_detect(7, GPIO.RISING, callback = Restart, bouncetime = 2000)
GPIO.add_event_detect(5, GPIO.FALLING, callback = Light, bouncetime= 500)






#========================================================Processes======================================================

processes = [Process(target=telemetryLoop), Process(target=cameraLoop), Process(target=actionLoop), Process(target=client.loop_forever)]
try:
    for p in processes:
        p.start()
    for p in processes:
        p.join()
except:
    errMessage = {"type": "device_error", "text": "Neznáma porucha zariadenia", "timestamp": str(datetime.datetime.now()),
                  "device": 1}
    client.publish("greenhouse/error", json.dumps(errMessage), 2, False)
    for p in processes:
        p.join()

