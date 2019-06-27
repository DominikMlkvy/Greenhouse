import sqlite3

def elementsCount( path, tabName, condition=""):
    db = sqlite3.connect(path)
    cursor = db.cursor()
    query = "SELECT count(*) FROM " + tabName + " " + condition
    cursor.execute(query)
    return cursor.fetchone()[0]

def collNames (path, tabName, condition="",):
    db = sqlite3.connect(path)
    cursor=db.cursor()
    query="SELECT * FROM " + tabName + " " +condition
    cursor.execute(query)
    row=cursor.fetchone()
    names = [description[0] for description in cursor.description]
    return names


def select (path, tabName, collumns="*", condition=""):
    db = sqlite3.connect(path)
    cursor=db.cursor()
    query="SELECT "+collumns + " FROM " + tabName + " " +condition
    try:
        cursor.execute(query)
    except:
        print "select failed"
        return None
    row = cursor.fetchone()
    if not row:
        return
    names =cursor.description
    result={}
    for i in range(len(row)):
        result.update({names[i][0]:row[i]})
                      
    return result


def selectMultiple(path, tabName, collumns="*", condition="", firstRow=0, rowCount="all"):
    db = sqlite3.connect(path)
    cursor = db.cursor()
    query = "SELECT " + collumns + " FROM " + tabName + " " + condition
    try:
        cursor.execute(query)
    except:
        print "select failed"
        return None
    all_rows = cursor.fetchall()
    if (not all_rows):
        return
    names = cursor.description
    if rowCount=="all":
        rowCount=len(all_rows)-firstRow
    rows=all_rows[firstRow: firstRow + rowCount]
    results=[]
    for row in rows:
        result = {}
        for i in range(len(row)):
            result.update({names[i][0]: row[i]})
        results.append(result)

    return results




"""
def select (path, tabName, collumns="*", condition="", index="last"):
    db = sqlite3.connect(path)
    cursor=db.cursor()
    query="SELECT "+collumns + " FROM " + tabName + " " +condition
    cursor.execute(query)
    all_rows = cursor.fetchall()
    i=0
    for row in all_rows:
        if i==index:
            return row
        else: i+=1
    db.close()
    return row
"""
"""
def selectMultiple(path, tabName, collumns="*", condition="", firstRow=0, rowCount="all"):
    db = sqlite3.connect(path)
    cursor = db.cursor()
    query = "SELECT " + collumns + " FROM " + tabName + " " + condition
    cursor.execute(query)
    all_rows = cursor.fetchall()
    if rowCount=="all":
        rowCount=len(all_rows)-firstRow
    rows=all_rows[firstRow: firstRow + rowCount]
    ###
    i = 0
    for row in all_rows:
        if i >= firstRow:
            rows.append(row)
        else:
            pass
    ###
    db.close()
    return rows

"""
def update (path, tabName, collumns, values, condition="last id"):
    if condition == "last id":
        condition = "WHERE   id = (SELECT MAX(id)  FROM " + tabName + ")"
    db = sqlite3.connect(path)
    cursor = db.cursor()
    querry= "UPDATE " + tabName + " SET " + collumns[0]+ " = "+str(values[0])
    for i in range (1, len(collumns)):
        querry += ", " + collumns[i] + " = " + str(values[i])
    querry += " " +condition
    try:
        cursor.execute(querry)
        db.commit()
        statement="update successful"
    except:
        db.rollback()
        statement="update failed"
    finally:
        db.close()
        return statement

def insert(path, tabName, values):
    db = sqlite3.connect(path)
    cursor = db.cursor()
    querry= "INSERT INTO " + tabName + " VALUES (" + values + " )"
    #print querry
    try:
        cursor.execute(querry)
        db.commit()
        statement = "insert successful"
    except:
        db.rollback()
        statement = "insert failed"
    finally:
        db.close()
        return statement


def delete (path, tabName, condition =""):
    db= sqlite3.connect(path)
    cursor=db.cursor()
    querry= "DELETE FROM "+tabName + " " + condition
    try:
        cursor.execute(querry)
        db.commit()
        statement = "update successful"
    except:
        db.rollback()
        statement = "update failed"
    finally:
        db.close()
        return statement


path ='Data/db.db'
newPath='Data/device_data.db'

#print select(newPath, "switches", "*" ,"WHERE id = 10");
#print update(path, "switches", ["heating", "watering", "lighting", "ventilation"],[0, 1, 1, 0])
"""
print select(path, "switches", '"heating", "watering", "lighting"', "", 1)
print update(path, "switches", ["heating", "watering", "lighting", "ventilation"],[0, 1, 0, 0], "WHERE id = 1 OR id = 2")
print select(path, "ui",)
#print insert(path, "telemetry", "20, 60, 70, 60, 10, 101900, 10, null ")
print selectMultiple(path, "switches", '"heating", "watering", "lighting"')
#print delete(path, "switches", "WHERE   id = (SELECT MAX(id)  FROM switches )")
print elementsCount(path, "switches", )
print update(path, "ui", ["d_temp", "s_hum_l"], [24, 70])
"""
