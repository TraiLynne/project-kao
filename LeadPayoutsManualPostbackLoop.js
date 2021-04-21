#!/usr/local/bin/node

'use strict';

const axios = require('axios');

// below urls are for a public API, safe to run for testing
// 'https://swapi.dev/api/people/1',
// 'https://swapi.dev/api/people/2',
// 'https://swapi.dev/api/people/3'

const urlList = [
  "https://www.kaotrk.com/tracking202/static/gpb.php?amount=34.56&subid=1487171-7871&t202txid=c933aac6-c256-414a-ba4a-a184b215c307",
];

Main();

async function Main() {
    let total = 0;

    for (let i = 0; i < urlList.length; i++) {
        try {
            let postbackResponse = await postback(urlList[i]);
            console.log(urlList[i], postbackResponse.status);
            total += 1;
        } catch (err) {
            console.error(err);
        }
    }
    console.log(`Total: ${total}`);
}

async function postback(postbackURL) {
        const response = await axios.get(postbackURL);
        return response;
}
