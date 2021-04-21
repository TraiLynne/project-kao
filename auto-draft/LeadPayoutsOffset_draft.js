/* 
Lead Payouts With Offset and NO Postback script

What it does: 
- Hits Even's leadPayouts endpoint using a zeroed timestamp generated from the current date/time minus the number of hours to offset
- Filters response for needed parameters and formats them
- Creates Kao postback URLs and pushes them to an array
- Output is only logged to the console
- Exits with error code 1 in case of any error being caught

Usage: 
$ node {script name} {number of hours to offset}
e.g. $ node LeadPayoutsOffset_NoPostback.js 6

Be Aware:
- this script can be used to safely preview the postback URLs, they are only logged to the console
- timestamp is cursor-based in Zulu time aka GMT/UTC. EST is GMT-5, EDT is GMT-4

- from my experimentation, an offset of 6 hours is the most reliable/accurate to use
- no offset lower than 6 hours generates any lead events
- an offset greater than 6 hours generates duplicate batches of events or has other problems
*/

"use strict";

const axios = require("axios");
require("dotenv").config();

/* Pre-script Setup */

// parsing cmd line args
if (process.argv.length !== 3) {
  console.log(
    "Incorrect number of arguments. Format should be: $ node {script.js} {argument}"
  );
  console.log("Example: $ node LeadPayoutsWithOffset.js 6");
  process.exitCode = 1;
  return;
}

const hoursToOffset = parseInt(process.argv[2]);

if (typeof hoursToOffset != "number" || isNaN(hoursToOffset)) {
  console.log("Incorrect type. Offset argument must be an int number.");
  console.log("Example: $ node LeadPayoutsWithOffset.js 6");
  process.exitCode = 1;
  return;
}
let timer = 900000;
Main();

setInterval(() => {
  Main();
}, timer);



function Main(){
  // get current time and format it into timestamp param (zeroing minutes, seconds, milliseconds)
  let currentDate = new Date();
  currentDate.setHours(currentDate.getHours() - hoursToOffset); // sets timestamp back x hours from current time
  currentDate.setMinutes(0);
  currentDate.setSeconds(0);
  currentDate.setMilliseconds(0);
  const timestamp = currentDate.toISOString().split(".")[0] + "Z"; // removes milliseconds and appends Z to end

  const leadPayoutsBaseURL =
    "https://api.evenfinancial.com/supplyAnalytics/leadPayouts?timestamp=";
  const leadPayoutsURL = leadPayoutsBaseURL + timestamp;

  // sets up timestamp used for logging
  let logDate = new Date();
  logDate.setMilliseconds(0);
  logDate = logDate.toISOString().split(".")[0] + "Z";

  console.log("......................................START");
  console.log(logDate);
  console.log("ATTEMPT REQUEST............................");
  console.log(`leadPayoutsURL: ${leadPayoutsURL}`);

  /* Script & Error Handling */

  getLeadPayouts(leadPayoutsURL)
    .then((leadPayoutsPayload) => {
      // anonymous function for logging pre-parse output
      console.log("REQUEST DONE...............................");
      return leadPayoutsPayload; // so next function in .then() chain gets data
    })
    .then(filterLeadPayouts)
    // This is where the Leads will be compared to the previous
    .then(removeDuplicateLeads)
    .then(createKaoURLs)
    .then((kaoURLsArray) => {
      // anonymous function for logging post-parse output
      console.log("PARSE DONE.................................");
      console.dir(kaoURLsArray, { maxArrayLength: null }); // prints full array irrespective of its length
      console.log(logDate, `Length of KaoURLsArray: ${kaoURLsArray.length}`);
      console.log("Ready to POSTBACK................................");

      return kaoURLsArray;
    })
    .then(postback)
    .then((requestsResponsesLog) => {
      // anonymous function for logging post-postback output
      console.log("POSTBACK DONE..............................");
      console.dir(requestsResponsesLog, { maxArrayLength: null }); // prints full array irrespective of its length
      console.log(
        logDate,
        `Number of Postbacks: ${requestsResponsesLog.length}`
      );
      console.log("........................................END");
      console.log(`Next run in ${timer/1000/60} Minutes`)
    })

    // all error handling done below
    .catch((error) => {
      console.log("##########   ERROR   ##########");
      if (error.response) {
        // Request made and server responded
        console.log("Response Error");
        console.log(`Status Code: ${error.response.status}`);
        console.log(error.response.data);
        console.log(error.response.headers);
        process.exitCode = 1; // set exit code to error code 1 before exiting while loop
        return;
      } else if (error.request) {
        // Request made but no response received
        console.log("Request Error");
        console.log(error.request);
        process.exitCode = 1; // set exit code to error code 1 before exiting while loop
        return;
      } else {
        // Error caused during request setup
        console.log("Request Setup Error");
        console.log("Error", error.message);
        process.exitCode = 1; // set exit code to error code 1 before exiting while loop
        return;
      }
    });
}

/* Functions */

/*
getLeadPayouts

Hits Even's leadPayouts endpoint with async GET request

Returns: response from leadPayouts endpoint as a JSON payload

TO DO: abstract bearerToken so not hard coded
*/

async function getLeadPayouts(leadPayoutsURL) {
  const bearerToken =
    "40aa1d92-1d7c-4c1c-8754-b02cf577a721_c16829a5-34d3-430e-80e8-0f3a8d4cf8ea";

  const axiosRequestOptions = {
    method: "GET",
    params: {
      showClientTags: "true", // set to 'true' to access 'clientTagJson' for 'client_id' key that contains 'subid' value
    },
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      Accept: "application/json",
    },
  };

  const leadPayoutsPayload = await axios.get(
    leadPayoutsURL,
    axiosRequestOptions
  );

  return leadPayoutsPayload;
}

/*
filterLeadPayouts

Parses JSON payload, finds the 3 Even params that Kao needs, pushes each trio of them to an array

Returns: an array containing the needed params, or an empty array if no lead payouts were found by the request

TO DO: handle what to do with invalid subid (i.e. '[[SUBID]]')
*/

function filterLeadPayouts(response) {
  let kaoParamsBundle = [];
  const leadPayoutPayload = response.data.data; // Axios uses 'data' as a special word meaning response body
  const skippedLeadEvents = [];

  // search through the payload for the 3 params needed within each lead event
  leadPayoutPayload.forEach((leadEvent) => {
    // let evenParamsBundle = [];

    let payout = leadEvent.payoutInCents;
    let leadUuid = leadEvent.leadUuid;
    let clientId = leadEvent.clientTagJson.find(
      (obj) => obj.key === "client_id"
    ).value;

    // Invalid Client ID handling
    isNaN(parseInt(clientId)) ? 
      skippedLeadEvents.push([[
        payout,
        leadUuid,
        clientId
      ], leadEvent])
      : kaoParamsBundle.push([
        payout, 
        leadUuid, 
        clientId]);
  });

  if(skippedLeadEvents.length > 0) {
    console.log(`${skippedLeadEvents.length} Lead Events skipped due to invalid Client ID`, skippedLeadEvents)
  }

  console.log(kaoParamsBundle)

  return kaoParamsBundle;
}

/*
createKaoURLs

Formats each trio of params and uses them to create the URLs meeting Kao's postback requirements

Returns: an array containing the formatted URLs, or an empty array if no lead payouts were found by the request
*/

function createKaoURLs(kaoParamsBundle) {
  const kaoBaseURL = "https://www.kaotrk.com/tracking202/static/gpb.php?";
  let kaoURLsArray = [];

  kaoParamsBundle.forEach((paramBundle) => {
    // [0]: payoutInCents [1]: leadUuid [2]: subid
    let convertedAmount = paramBundle[0] / 100;
    let leadUuid = paramBundle[1];
    let subid = paramBundle[2];

    let kaoFormattedURL =
      `${kaoBaseURL}` +
      `amount=` +
      `${convertedAmount}` +
      `&subid=` +
      `${subid}` +
      "&t202txid=" +
      `${leadUuid}`;
    kaoURLsArray.push(kaoFormattedURL);
  });

  return kaoURLsArray;
}



/* 
removeDuplicateLeads

Checks each lead to see if it was in the previous pull and moves only new leads on to the next phase.

Returns: n array containing the needed params of new lead payouts, or an empty array if no lead payouts were found by the request
*/
let previousEvents = [];

function removeDuplicateLeads(paramBundle){
  let newLeadPayouts = [];
  let skipped = 0;

  if(previousEvents.length < 1){
    previousEvents = paramBundle;
    newLeadPayouts = paramBundle;
  } else {
    paramBundle.forEach((bundle) => {
      if(previousEvents.includes(bundle)){
        newLeadPayouts.push(bundle);
      } else {
        skipped++;
      }
    });
  }

  previousEvents = paramBundle;

  console.log(`${skipped} duplicate leads skipped`);

  return newLeadPayouts;
}

async function postback(kaoURLsArray) {
  let requestsResponsesLog = [];

  for (let i = 0; i < kaoURLsArray.length; i++) {
    try {
      let postbackResponse = await axios.get(kaoURLsArray[i]);
      let loggedResponse = {
        kaoURL: kaoURLsArray[i],
        statusCode: postbackResponse.status,
      };
      requestsResponsesLog.push(loggedResponse);
      console.log(kaoURLsArray[i], postbackResponse.status);
    } catch (err) {
      console.error(err);
    }
  }

  return requestsResponsesLog
}