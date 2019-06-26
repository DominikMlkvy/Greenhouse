import RPi.GPIO as GPIO
import time

channel = 20

# GPIO setup
GPIO.setmode(GPIO.BCM)


def switch (pin, value):
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(pin, GPIO.OUT)
    if value == True :
        GPIO.output(pin, GPIO.LOW)
    elif value == False:
        GPIO.output(pin, GPIO.HIGH)
    else:
        print "Wrong command"
        
    return value

def read (pin):
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(pin, GPIO.IN)
    state = GPIO.input(pin)
    #GPIO.cleanup()
    return state

def motor_full (pins, value, degree):
    GPIO.setmode(GPIO.BCM)
    for pin in pins:
        GPIO.setup(pin, GPIO.OUT)
        
    steps=int(degree/360.0*2048)
    if value:
        direction = 1
    elif not value:
        direction = -1
    else:
        print "Wrong value"
        return
    
    for i in range(steps):
        on = (i%4)*direction
        on2=((i+1)%4)*direction
        for p in range (len(pins)):
            GPIO.output(pins[p], GPIO.LOW)
        GPIO.output(pins[on], GPIO.HIGH)
        GPIO.output(pins[on2], GPIO.HIGH)
        #print on, " - ", on2
        time.sleep(.002)
        
    for pin in pins:
        GPIO.output(pin, GPIO.LOW)
    return value

def motor_half (pins, value, degree):
    GPIO.setmode(GPIO.BCM)
    for pin in pins:
        GPIO.setup(pin, GPIO.OUT)
        
    steps=int(degree/360.0*4096)
    if value:
        direction = 1
    elif not value:
        direction = -1
    else:
        print "Wrong value"
        return
    for i in range(steps):
        on = (i%8)/2*direction
        on2=((i+1)%8)/2*direction
        for p in range (len(pins)):
            GPIO.output(pins[p], GPIO.LOW)
        GPIO.output(pins[on], GPIO.HIGH)
        GPIO.output(pins[on2], GPIO.HIGH)
        time.sleep(.001)

    for pin in pins:
        GPIO.output(pin, GPIO.LOW)
    return value



"""
print motor_half ([5,6,13,19], True, 180)
time.sleep(.100)
print motor_full([5,6,13,19], False, 180)
"""
