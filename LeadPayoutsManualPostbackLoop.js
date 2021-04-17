#!/usr/local/bin/node

'use strict';

const axios = require('axios');

// below urls are for a public API, safe to run for testing
// 'https://swapi.dev/api/people/1',
// 'https://swapi.dev/api/people/2',
// 'https://swapi.dev/api/people/3'

const urlList = [
  "https://www.kaotrk.com/tracking202/static/gpb.php?amount=0.848&subid=1503353-7871&t202txid=3dfb5792-a005-4d92-9a21-a44d7c42e4e6",
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
