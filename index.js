var sqlite3 = require('sqlite3').verbose();
var express = require('express');
var http = require('http');
var path = require("path");
var bodyParser = require('body-parser');
var helmet = require('helmet');
var rateLimit = require("express-rate-limit");
var app = express();
var server = http.createServer(app);

var namesArr = [];
var timesArr = [];
var datesArr = [];  //dates = descriptions

var taskNum = 0;
var totalTaskTime = 0;
var taskTimeCounter = 0;
var taskTimePerDay = 0;

const { google } = require('googleapis')

const { OAuth2 } = google.auth

const oAuth2Client = new OAuth2(
  '365485670929-4bcibh5oro817koblavv4ii40sj338r9.apps.googleusercontent.com',
  'AJlxioEwhcjjxF8QBM4lZSnT'
)

oAuth2Client.setCredentials({
  refresh_token: '1//04ubtT4Z6YfCdCgYIARAAGAQSNwF-L9Ir2Lnb6I-PzY30n0aik8LLSJWDQPh4_yx0_STKJRgDqerwT8o6PjnesMbPZ5uyguKi6lU',
})

const calendar = google.calendar({ version: 'v3', auth: oAuth2Client })

const currentDay = new Date();
currentDay.setDate(currentDay.getDay() + 12);
currentDay.setHours(14,0,0);


const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100 
});

var db = new sqlite3.Database('./database/tasks.db');


app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static(path.join(__dirname,'./public')));
app.use(helmet());
app.use(limiter);

db.run('CREATE TABLE IF NOT EXISTS input(name TEXT, time TEXT, date TEXT)');

app.get('/', function(req,res){
  res.sendFile(path.join(__dirname,'./public/form.html'));
});

// Add
app.post('/add', function(req,res){
  db.serialize(()=>{
    db.run('INSERT INTO input(name,time,date) VALUES(?,?,?)', [req.body.name, req.body.time, req.body.date], function(err) {
      if (err) {
        return console.log(err.message);
      }
      console.log("New task has been added");
    });
  });
    AssignValues();
});

function AssignValues(){

let names = `SELECT DISTINCT Name name FROM input
           ORDER BY name`;

let times = `SELECT DISTINCT Time time FROM input
           ORDER BY time`;           

//dates = descriptions--changing to descriptions caused a          persisting bug for an unknown reason
let dates = `SELECT DISTINCT Date date FROM input
           ORDER BY date`;             



db.all(times, [], (err, rows) => {
  if (err) {
    throw err;
  }
 
  const string = new String(rows[0].time);

    timesArr = string.replace(/, +/g, ",").split(",").map(Number);

})

db.all(names, [], (err, rows) => {
  if (err) {
    throw err;
  }
    const string2 = new String(rows[0].name);
    namesArr = string2.replace(/, +/g, ",").split(",").map(String);

})
db.all(dates, [], (err, rows) => {
  if (err) {
    throw err;
  }
    const string3 = new String(rows[0].date);

    datesArr = string3.replace(/, +/g, ",").split(",").map(String);
done(rows);
})

//Waits for data to be added to arrays
function done(rows) {

  ProcessTasks(); 
}
  
}

function ProcessTasks(){

  taskNum = timesArr.length;
  for(var i = 0; i < taskNum; i++){
    totalTaskTime += timesArr[i];
  }

  taskTimePerDay = totalTaskTime/5;


const slowAndSteady = new Promise(function(resolve, reject) {
    setTimeout(function() {
        
        CreateEvent(namesArr[0], timesArr[0], datesArr[0]);
        resolve();
        currentDay.setHours(currentDay.getHours() + 1);
        taskTimeCounter += timesArr[0];
    }, 10000);
});

(async function() {
    await slowAndSteady;
    
    CreateEvent(namesArr[1], timesArr[1], datesArr[1]);
    currentDay.setHours(currentDay.getHours() + 1);
    taskTimeCounter += timesArr[1];
})();

const slowAndSteady2 = new Promise(function(resolve, reject) {
    setTimeout(function() {
         
        CreateEvent(namesArr[2], timesArr[2], datesArr[2]);
        resolve();
        currentDay.setHours(currentDay.getHours() + 1);
        taskTimeCounter += timesArr[2];
    }, 10000);
});

(async function() {
    await slowAndSteady2;
    //CreateEvent(namesArr[1], timesArr[1], datesArr[1]);
})();



}

function CreateEvent(name, time, date){

if(taskTimeCounter >= taskTimePerDay){
  FindTime(arguments[0],arguments[1],arguments[2]);
  return;
}

if(taskTimeCounter < taskTimePerDay){

//const event2 = new Date(arguments[2]);

const event3 = new Date(currentDay);
event3.setMinutes(event3.getMinutes() + arguments[1]);

const eventStartTime = currentDay.toISOString()

const eventEndTime = event3.toISOString() 

const event = {
  summary: arguments[0],
  location: ``,
  description: arguments[2],
  colorId: 1,
  start: {
    dateTime: eventStartTime,
    timeZone: 'America/New_York',
  },
  end: {
    dateTime: eventEndTime,
    timeZone: 'America/New_York',
  },
}

calendar.freebusy.query(
  {
    resource: {
      timeMin: eventStartTime,
      timeMax: eventEndTime,
      timeZone: 'America/New_York',
      items: [{ id: 'primary' }],
    },
  },

  (err, res) => {

    if (err) return console.error('Free Busy Query Error: ', err)
    
    const eventArr = res.data.calendars.primary.busy
    
    if (eventArr.length === 0)

      return calendar.events.insert(
        { calendarId: 'primary', resource: event },
        err => {

          if (err) return console.error('Error Creating Calender Event:', err)

          return console.log('Calendar event successfully created.')
        }
      )

    FindTime(arguments[0],arguments[1],arguments[2]);
    return console.log(`I'm busy!`)

  }
)
}
}

function FindTime(name,time,date){

  if(taskTimeCounter >= taskTimePerDay){
    currentDay.setDate(currentDay.getDate() + 1);  
    currentDay.setHours(14,0,0);
    taskTimeCounter = 0;
    CreateEvent(arguments[0],arguments[1],arguments[2]);
    return;
  }
  
  currentDay.setHours(currentDay.getHours() + 1);
  CreateEvent(arguments[0],arguments[1],arguments[2]);
  console.log('Finding new time');
  
}

// Closing the database connection.
app.get('/close', function(req,res){
  db.close((err) => {
    if (err) {
      res.send('There is some error in closing the database');
      return console.error(err.message);
    }

    const fs = require('fs')

    const path1 = './database/tasks.db'

    try {
     fs.unlinkSync(path1)
     //file removed
  }     catch(err) {
  console.error(err)
  }
  
    console.log('Closing the database connection.');
    res.send('Database connection successfully closed');
  });

});

server.listen(3000, function(){
  console.log("server is listening on port: 3000");
});
