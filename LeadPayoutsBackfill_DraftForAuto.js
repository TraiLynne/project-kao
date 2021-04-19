/* 
Lead Payouts Backfill with NO Postback script

What it does: 
- Hits Even's leadPayouts endpoint using the timestamp supplied as a command line argument as a starting point
- Filters response for needed parameters and formats them
- Creates Kao postback URLs and pushes them to an array
- Uses nextUrl from the responses to make new requests in a loop until latest up-to-date batch of data is received
- Output is only logged to the console
- Exits with success code 0 once the API responds with status code: 422 and type: malformed. This means end of available data has been reached
- Exits with error code 1 in all other cases

Usage: 
$ node {script name} {timestamp to start at}
e.g. $ node LeadPayoutsBackfill_NoPostback.js 2021-01-21T20:00:00Z

Be Aware:
- ladPayoutsURL is passed as an arg through each async function in the chain so the loop can replace it with nextUrl for subsequent requests
- script does not check if timestamp's format is correct. Any error due to this will come from API error response with status code: 422 and type: missing
- timestamp is cursor-based in Zulu time aka GMT/UTC. EST is GMT-5, EDT is GMT-4
*/

'use strict';
const axios = require('axios');

/* Pre-script Setup */

  // check number of cmd line args is correct
  if (process.argv.length !== 3) {
    console.log("Incorrect format. Should be: $ node {script.js} {timestamp}");
    console.log("Example: $ node LeadPayoutsBackfill_NoPostback.js 2021-04-03T20:00:00Z");
    process.exitCode = 1;
    return;
};

const timestamp = process.argv[2];

Main(); // necessary to call an async main function to be able to await the returns from the chain of async functions

/* Main Function */
let baseURL = "http://localhost:5000";

async function Main() {
  const leadPayoutsBaseURL =
    "http://localhost:5000/supplyAnalytics/leadPayouts?timestamp=";
  let leadPayoutsURL = leadPayoutsBaseURL + timestamp;

  let totalKaoUrls = 0;

  while (leadPayoutsURL) {
    try {
      console.log("hey");
      console.log('ATTEMPT REQUEST............................');
      console.log(`leadPayoutsURL: ${leadPayoutsURL}`);
      

      let fullKaoURLsBundle = await createKaoURLs(leadPayoutsURL);

      console.log(fullKaoURLsBundle);
      // console.log('REQUEST DONE...............................');
      // totalKaoUrls += fullKaoURLsBundle.kaoURLsArray.length;
      // console.log(`Length of KaoURLsBundle: ${fullKaoURLsBundle.kaoURLsArray.length}`);
      // console.dir(fullKaoURLsBundle.kaoURLsArray, {'maxArrayLength': null}); // prints full list of URLs in console no matter its length
      // console.log('BATCH DONE.................................');
      // console.log(`Total number of Kao URLs so far: ${totalKaoUrls}`);

      // leadPayoutsURL = fullKaoURLsBundle.nextUrl;
// All error handling below
} catch (error) {
  if (error.response.status === 422) { // 422 status code errors handled specially for script functionality
    const errorData = error.response.data;
    let detailType, detailMessage;
    errorData.forEach(detail => {
      detailType = detail.type;
      detailMessage = detail.message;
    });
    if (detailType === 'malformed') {
      console.log('########## Reached end of available data. This is expected behavior. ##########');
      console.log('(API response data produced below in case it is needed)');
      console.log(`Status Code: ${error.response.status}`);
      console.log(errorData);
      process.exitCode = 0; // set exit code to success code 0 before exiting while loop
      return;
    } else if (detailType === 'missing') {
      console.log('########## Timestamp is missing or format is incorrect. Example format: 2021-04-03T20:00:00Z ##########');
      console.log('(API response data produced below in case it is needed)');
      console.log(`Status Code: ${error.response.status}`);
      console.log(errorData);
      process.exitCode = 1; // set exit code to error code 1 before exiting while loop
      return;
    }
  }
  console.log('##########   ERROR   ##########'); // non-422 status code errors handled here
  if (error.response) { // Request made and server responded
    console.log('Response Error');
    console.log(`Status Code: ${error.response.status}`);
    console.log(error.response.data);
    // console.log(error.response.headers);
    process.exitCode = 1; // set exit code to error code 1 before exiting while loop
    return;
  } else if (error.request) { // Request made but no response received
    console.log('Request Error');
    console.log(error.request);
    process.exitCode = 1; // set exit code to error code 1 before exiting while loop
    return;
  } else { // Error caused during request setup
    console.log('Request Setup Error');
    console.log('Error', error.message);
    process.exitCode = 1; // set exit code to error code 1 before exiting while loop
    return;
  }
}
}
};

/* Functions */

/*
getLeadPayouts

Hits Even's leadPayouts endpoint with async GET request

Returns: response from leadPayouts endpoint as a JSON payload

TO DO: abstract bearerToken so not hard coded
*/

async function getLeadPayouts(leadPayoutsURL) {

const bearerToken = '40aa1d92-1d7c-4c1c-8754-b02cf577a721_c16829a5-34d3-430e-80e8-0f3a8d4cf8ea'

const axiosRequestOptions =  { 
method: 'GET',
params: {
  showClientTags: 'true' // set to 'true' to access 'clientTagJson' for 'client_id' key that contains 'subid' value
},
headers: { 
  Authorization: `Bearer ${bearerToken}`,
  Accept: 'application/json'
}
};

const leadPayoutsPayload = await axios.get(leadPayoutsURL, axiosRequestOptions);

return leadPayoutsPayload;
}

/*
filterLeadPayouts

Parses JSON payload, finds the 3 Even params that Kao needs, pushes each trio of them to an array

Returns: an array containing the needed params, or an empty array if no lead payouts were found by the request

TO DO: handle what to do with invalid subid (i.e. '[[SUBID]]')
*/

async function filterLeadPayouts(leadPayoutsURL) {

  const response = await getLeadPayouts(leadPayoutsURL);
  let kaoParamsBundle = [];
  const nextUrl = response.data.nextUrl;
  const leadPayoutBlob = response.data.data; // Axios uses 'data' as a special word meaning response body

  leadPayoutBlob.forEach((leadEvent) => {
  let evenParamsBundle = [];
  evenParamsBundle.push(leadEvent.payoutInCents);
  evenParamsBundle.push(leadEvent.leadUuid);
  let findClientIDs = leadEvent.clientTagJson.find(obj => obj.key === "client_id");
  evenParamsBundle.push(findClientIDs.value);
  kaoParamsBundle.push(evenParamsBundle);
  });
  let fullParamsBundle = {nextUrl: nextUrl, kaoParamsBundle: kaoParamsBundle};

  return fullParamsBundle;
}

/*
createKaoURLs

Formats each trio of params and uses them to create the URLs meeting Kao's postback requirements

Returns: object with keys: nextUrl and kaoURLsArray, or an empty array if no lead payouts were found by the request
*/

async function createKaoURLs(leadPayoutsURL) {

  const fullParamsBundle = await filterLeadPayouts(leadPayoutsURL);

  let kaoParamsBundle = fullParamsBundle.kaoParamsBundle;
  let nextUrl = fullParamsBundle.nextUrl;
  let kaoBaseURL = 'https://www.kaotrk.com/tracking202/static/gpb.php?'
  let kaoURLsArray = [];

  kaoParamsBundle.forEach((paramBundle) => { 
    // [0]: payoutInCents [1]: leadUuid [2]: subid
    let convertedAmount = paramBundle[0] / 100;
    let leadUuid = paramBundle[1];
    let subid = paramBundle[2];

    let kaoFormattedURL = `${kaoBaseURL}`+`amount=`+`${convertedAmount}`+`&subid=`+`${subid}`+'&t202txid='+`${leadUuid}`;
    kaoURLsArray.push(kaoFormattedURL);
  });

  let fullKaoURLsBundle = {nextUrl: nextUrl, kaoURLsArray: kaoURLsArray};
  
  return fullKaoURLsBundle;
}
