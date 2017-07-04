'use strict';

var Alexa = require('alexa-sdk');
var http = require('http'); 
var querystring = require('querystring');

var APP_ID = undefined; // TODO replace with your app ID (OPTIONAL).

var HeaterMeterHost=process.env.heatermeterHost;
var apiKey = process.env.apiKey;

// Route the incoming request based on type (LaunchRequest, IntentRequest, 
// etc.) The JSON body of the request is provided in the event parameter. 
exports.handler = function (event, context) { 
   try { 
       console.log("event.session.application.applicationId=" + event.session.application.applicationId); 
       /** 
        * Uncomment this if statement and populate with your skill's application ID to 
        * prevent someone else from configuring a skill that sends requests to this function. 
        */ 
       /* 
       if (event.session.application.applicationId !== "amzn1.echo-sdk-ams.app.[unique-value-here]") { 
            context.fail("Invalid Application ID"); 
       } 
       */ 
       if (event.session.new) { 
           onSessionStarted({ requestId: event.request.requestId }, event.session); 
       } 
       if (event.request.type === "LaunchRequest") { 
           onLaunch(event.request, 
               event.session, 
               function callback(sessionAttributes, speechletResponse) { 
                   context.succeed(buildResponse(sessionAttributes, speechletResponse)); 
               }); 
       } else if (event.request.type === "IntentRequest") { 
           onIntent(event.request, 
               event.session, 
               function callback(sessionAttributes, speechletResponse) { 
                   context.succeed(buildResponse(sessionAttributes, speechletResponse)); 
               }); 
       } else if (event.request.type === "SessionEndedRequest") { 
           onSessionEnded(event.request, event.session); 
           context.succeed(); 
       } 
   } catch (e) { 
       context.fail("Exception: " + e); 
   } 
}; 

/** 
* Called when the session starts. 
*/ 
function onSessionStarted(sessionStartedRequest, session) { 
   console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId + ", sessionId=" + session.sessionId); 
} 

/** 
* Called when the user launches the skill without specifying what they want. 
*/ 
function onLaunch(launchRequest, session, callback) { 
   console.log("onLaunch requestId=" + launchRequest.requestId + ", sessionId=" + session.sessionId); 
   // Dispatch to your skill's launch. 
   getWelcomeResponse(callback); 
} 

/** 
* Called when the user specifies an intent for this skill. 
*/ 
function onIntent(intentRequest, session, callback) { 
    console.log("onIntent requestId=" + intentRequest.requestId + ", sessionId=" + session.sessionId); 
    var intent = intentRequest.intent, 
    intentName = intentRequest.intent.name; 

    // Dispatch to your skill's intent handlers 
    switch (intentName){
        case "WelcomeIntent":
            getWelcomeResponse(callback); 
            break;
        case "ProbeTempIntent":
            GetProbeTemp(intent, session, callback); 
            break;
        case "PitProbeTempIntent":
            GetPitProbeTemp(intent, session, callback); 
            break;
        case "AllProbesTempIntent":
            GetAllProbeTemp(intent, session, callback); 
            break;
        case "SetPointTempIntent":
            GetSetPointTemp(intent, session, callback); 
            break;
        case "ChangeSetPointIntent":
            ChangeSetPointTemp(intent, session, callback); 
            break;
        case "AMAZON.HelpIntent":
            getHelpResponse(callback); 
            break;
        case "AMAZON.StopInten" || "AMAZON.CancelIntent":
            handleSessionEndRequest(callback);
            break;                    
        default:
            throw "Invalid intent";
    }
} 

/** 
* Called when the user ends the session. 
* Is not called when the skill returns shouldEndSession=true. 
*/ 
function onSessionEnded(sessionEndedRequest, session) { 
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId + ", sessionId=" + session.sessionId); 
    // Add cleanup logic here 
} 

// --------------- Functions that control the skill's behavior ----------------------- 
function getWelcomeResponse(callback) { 
    // If we wanted to initialize the session to have some attributes we could add those here. 
    var sessionAttributes = {}; 
    var cardTitle = "HeaterMeter"; 
    var speechOutput = "<p>Welcome to the Heatermeter Alexa skill </p> <p>Please ask me to give you the current status</p>"; 
    var repromptText = "Please ask me to give you the barbeque temp"; 
    var shouldEndSession = false; 
    callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, true)); 
} 

function handleSessionEndRequest(callback) { 
    var cardTitle = "Session Ended"; 
    var speechOutput = "Thank you for using the Heatermeter skill."; 
    callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, true)); 
} 

/**s 
* Sets the color in the session and prepares the speech to reply to the user. 
*/ 
function GetProbeTemp(intent, session, callback) { 
    var cardTitle = "ProbeTemp"; 
    var probeSlot = intent.slots.probe; 

    if (probeSlot && probeSlot.value) { 
        var probe = probeSlot.value; 
        getStatusRequest(probe, cardTitle, callback); 
    } else { 
        var speechOutput = 'I was unable to process your request. This is a work in progress please try again'; 
        callback({}, buildSpeechletResponse(cardTitle, speechOutput, "", false)); 
    } 
} 

function GetPitProbeTemp(intent, session, callback) { 
    var cardTitle = "PitProbeTemp"; 
    getStatusRequest(0, cardTitle, callback);  
} 

function GetAllProbeTemp(intent, session, callback) { 
    var cardTitle = "AllProbesTemp"; 
    getStatusRequest(null, cardTitle, callback);
} 

function GetSetPointTemp(intent, session, callback) { 
    var cardTitle = "SetPointTemp";
    getStatusRequest(null, cardTitle, callback);
} 

function ChangeSetPointTemp(intent, session, callback){
    var cardTitle = "ChangeSetPointTemp";

    var newTempSlot = intent.slots.newTemp; 

    if (newTempSlot && newTempSlot.value) { 
        var newTemp = newTempSlot.value; 

        var form_data = querystring.stringify({ 'value': newTemp});
        var options = {
            host: HeaterMeterHost,
            path: '/cgi-bin/luci/lm/api/config/sp?apikey=' + apiKey,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(form_data)
            }
        };

        var req = http.request(options, function(res){
            var result = '';
            console.log('Status: ' + res.statusCode);
            console.log('Headers: ' + JSON.stringify(res.headers));
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                result += chunk;
            });
            res.on('end', function() {
                console.log("RESULT: " + result);
                speechOutput = buildSpeechOutput(newTemp, cardTitle, result);
                callback({}, buildSpeechletResponse(cardTitle, speechOutput, "", true));
            });
            res.on('error', function (err) {
                console.log(err);
            });
        });
        req.on('error', function(e) {
            console.log('problem with request: ' + e.message);
        });
        req.write(form_data);
        req.end();
    }
    else{
        var speechOutput = 'I was unable to process your request. This is a work in progress please try again'; 
        var repromptText = "I'm not sure what you wanted. . Please ask me to ..."; 
        callback({}, buildSpeechletResponse(cardTitle, speechOutput, repromptText, false)); 
    }
}

function getHelpResponse(callback) { 
    return 0;
}

function getStatusRequest(probe, cardTitle, callback){
     var options = {
        host: HeaterMeterHost,
        path: '/cgi-bin/luci/lm/api/status',
        method: 'GET'
    };

    var req = http.request(options, function(res){
        var result = '';
        var speechOutput = '';
        var jsonStatus;
        console.log('Status: ' + res.statusCode);
        console.log('Headers: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            result += chunk;
        });
        res.on('end', function() {
            console.log("RESULT: " + result);
            jsonStatus = JSON.parse('' + result); 
            speechOutput = buildSpeechOutput(probe, cardTitle, jsonStatus);
            callback({}, buildSpeechletResponse(cardTitle, speechOutput, "", true));
        });
        res.on('error', function (err) {
            console.log(err);
        });
    });
    req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
        speechOutput = 'I was unable to find process your request'; 
        repromptText = 'Please ask me again'; 
        callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, true)); 
    });
    req.end();
}


// --------------- Helpers that build all of the responses ----------------------- 
function setpointTempMessage(json){
    return "<p> Currently set for " + json.set + " degrees </p>";
}

function probesTempMessage(probe, json){
    if ( !json.temps[probe].c )
        return "<p> Probe " + probe + " is not plugged in </p>";
    return "<p> Probe " + probe + "'s temperature is " + json.temps[probe].c + "</p>";
}

function pitProbesTempMessage(json){
    return "<p> The pit probe's temperature is " + json.temps[0].c + " degrees </p>";
}

function changePitSetPointMessage(newTemp, body){
    return "<p> New setpoint is <say-as interpret-as=\"cardinal\">" + newTemp + "</say-as> degrees </p>";
}

function buildSpeechOutput(arg, cardTitle, response){
    var speechOut="";
    switch (cardTitle){
        case "AllProbesTemp":
            speechOut = setpointTempMessage(response) + pitProbesTempMessage(response) + probesTempMessage(1, response) + probesTempMessage(2, response) + probesTempMessage(3, response);
            break;
        case "SetPointTemp":
            speechOut = setpointTempMessage(response);
            break;
        case "PitProbeTemp":
            speechOut = pitProbesTempMessage(response) + setpointTempMessage(response);
            break;
        case "ChangeSetPointTemp":
            speechOut = changePitSetPointMessage(arg, response);
            break;
        default:
            speechOut = probesTempMessage(arg, response)
            break;
    }

    return speechOut;
}

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) { 
   return { 
       outputSpeech: { 
           type: "SSML", 
           ssml: "<speak>" + output + "</speak>"
       }, 
       card: { 
           type: "Simple", 
           title: "Temperature - " + title, 
           content: "" + output 
       }, 
       reprompt: { 
           outputSpeech: { 
               type: "PlainText", 
               text: repromptText 
           } 
       }, 
       shouldEndSession: shouldEndSession 
   }; 
} 

function buildResponse(sessionAttributes, speechletResponse) { 
   return { 
       version: "1.0", 
       sessionAttributes: sessionAttributes, 
       response: speechletResponse 
   }; 
} 