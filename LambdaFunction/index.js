'use strict';

var Alexa = require('alexa-sdk');
var http = require('http'); 
var querystring = require('querystring');

var APP_ID = undefined; // TODO replace with your app ID (OPTIONAL).

var HeaterMeterHost=process.env.heatermeterHost;
var HeaterMeterPort=process.env.heatermeterPort;
var apiKey = process.env.apiKey;

var newline = "\n";

var output = "";

var alexa;

function GetHeaterMeterPort() {
    return HeaterMeterPort || 80;
}

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

var handlers = {
    'LaunchRequest': function () {
        this.attributes['speechOutput'] = this.t("WELCOME_MESSAGE", this.t("SKILL_NAME"));
        // If the user either does not reply to the welcome message or says something that is not
        // understood, they will be prompted again with this text.
        this.attributes['repromptSpeech'] = this.t("WELCOME_REPROMPT");
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptSpeech'])
    },
    'ProbeTempIntent': function() {
        var cardTitle = "ProbeTemp"; 
        GetPitProbeTemp(this);
    },
    'PitProbeTempIntent': function() {
        var cardTitle = "PitProbeTemp"; 
        getStatusRequest(0, cardTitle, this);  
    },
    'AllProbesTempIntent': function() {
        var cardTitle = "AllProbesTemp"; 
        getStatusRequest(null, cardTitle, this);
    },
    'SetPointTempIntent': function() {
        var cardTitle = "SetPointTemp";
        getStatusRequest(null, cardTitle, this);
    },
    'ChangeSetPointIntent': function() {
        ChangeSetPointTemp(this); 
    },
    'AMAZON.HelpIntent': function () {
        this.attributes['speechOutput'] = this.t("HELP_MESSAGE");
        this.attributes['repromptSpeech'] = this.t("HELP_REPROMPT");
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptSpeech'])
    },
    'AMAZON.RepeatIntent': function () {
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptSpeech'])
    },
    'AMAZON.StopIntent': function () {
        this.emit('SessionEndedRequest');
    },
    'AMAZON.CancelIntent': function () {
        this.emit('SessionEndedRequest');
    },
    'SessionEndedRequest':function () {
        this.emit(':tell', this.t("STOP_MESSAGE"));
    },
    'Unhandled': function () {
        this.attributes['speechOutput'] = this.t("HELP_MESSAGE");
        this.attributes['repromptSpeech'] = this.t("HELP_REPROMPT");
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptSpeech'])
    }
};


function GetProbeTemp(handler) { 
    var cardTitle = "ProbeTemp"; 
    var intent = handler.event.request.intent;
    var probeSlot = intent.slots.probe; 

    if (probeSlot && probeSlot.value) { 
        var probe = probeSlot.value; 
        getStatusRequest(probe, cardTitle); 
    } else { 
        var speechOutput = 'I was unable to process your request. This is a work in progress please try again'; 
        handler.emit(':tellWithCard', speechOutput, cardTitle, output);
    } 
} 

function ChangeSetPointTemp(handler){
    var cardTitle = "ChangeSetPointTemp";
    var intent = handler.event.request.intent
    var responseOutput;
    var speechOutput;
    var newTempSlot = intent.slots.newTemp; 
    if (newTempSlot && newTempSlot.value) {
        var newTemp = newTempSlot.value; 
        var oldTemp;

        getStatusPromise(null)
        .then ( (response) => {
            oldTemp=response.set;
            return changeSetpointPromise(newTemp);
        })
        .then( (response) => {
            console.log("Change Setpoint Response: " + response);
            speechOutput = "I have changed the setpoint from <say-as interpret-as=\"cardinal\">" + 
                oldTemp + "</say-as>  to <say-as interpret-as=\"cardinal\">" + newTemp + "</say-as>degrees";
            handler.emit(':tellWithCard', speechOutput, cardTitle, speechOutput, null );
        },
        (reason) => console.log("ERROR: " + reason))
        .catch((err) => console.error(err));  
    }
    else {
        console.log ('No new temperature was passed in.');
    }
}

function changeSetpointPromise (newTemp) {
    return new Promise( (resolve, reject) => {
        var form_data = querystring.stringify({ 'value': newTemp});
        var options = {
            host: HeaterMeterHost,
            port: GetHeaterMeterPort(),
            path: '/cgi-bin/luci/lm/api/config/sp?apikey=' + apiKey,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(form_data)
            }
        };

        var req = http.request(options, (res) => {
            var result = '';
            console.log('Status: ' + res.statusCode);
            console.log('Headers: ' + JSON.stringify(res.headers));
            res.setEncoding('utf8');
            res.on('data', (chunk) => result += chunk);
            res.on('end', () => {
                if (result.includes("sp to " + newTemp + " = OK"))
                    resolve (result);
                else
                    reject ("something went wrong." + result);
            });
        });
        req.on('error', (err) => reject (err))
        req.write(form_data);
        req.end();
    })
};




function getStatusRequest(probe, cardTitle, handler){
    var response;
    var speechOutput;

    getStatusPromise(probe)
        .then( (response) =>  {
            console.log("RESPONSE: " + response );
            speechOutput = buildSpeechOutput(probe, cardTitle, response);
            handler.emit(':tellWithCard', speechOutput, cardTitle, speechOutput, null );
        },
        (reason) => console.log("ERROR: " + reason))
        .catch( (err) => console.error('Something went wrong', err));
}

function getStatusPromise(probe) {
    return new Promise( (resolve, reject) => {
        var options = {
                host: HeaterMeterHost,
                port: GetHeaterMeterPort(),
                path: '/cgi-bin/luci/lm/api/status',
                method: 'GET'
        };

        var req = http.request(options, (res) => {
            var result = '';
            console.log('Status: ' + res.statusCode);
            console.log('Headers: ' + JSON.stringify(res.headers));
            res.setEncoding('utf8');
            res.on('data', (chunk) => result += chunk);
            res.on('end', () => {
                console.log (result);
                resolve( JSON.parse('' + result) )
            });
            res.on('error',  (err) => reject (err));
        });
        req.on('error', (err) => reject (err));
        req.end();
    })
}


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
        default:
            speechOut = probesTempMessage(arg, response)
            break;
    }

    return speechOut;
}

function buildSpeechResponse(title, output, repromptText, shouldEndSession) { 
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


var languageStrings = {
    "en": {
        "translation": {
            "SKILL_NAME": "Heater Meter",
            "WELCOME_MESSAGE": "Welcome to %s. You can ask a question like, what temperature is the pit, or change set point to 200 degrees? ... Now, what can I help you with.",
            "WELCOME_REPROMPT": "For instructions on what you can say, please say help me.",
            "DISPLAY_CARD_TITLE": "%s  - Recipe for %s.",
            "HELP_MESSAGE": "You can ask questions such as, what\'s temperature is the pit, or change set point to 200 degrees, or, you can say exit...Now, what can I help you with?",
            "HELP_REPROMPT": "You can say things like, what\'s the current status, or what is probe 1\'s temperature, or you can say exit...Now, what can I help you with?",
            "STOP_MESSAGE": "Goodbye!",
            "REPEAT_MESSAGE": "Try saying repeat.",
            "NOT_FOUND_MESSAGE": "I\'m sorry, I currently do not know ",
            "REPROMPT": "What else can I help with?",
            "LET_ME_CHECK": "Let me check."
        }
    }
}

