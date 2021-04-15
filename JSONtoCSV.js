'use strict';
​
const fs = require('fs');
 
let kaoParams = [];
​
fs.readFile('response.json', (err, payload) => {
    if (err) throw err;
    let blob = JSON.parse(payload);
    const data = blob.data;
    data.forEach((leadEvent) => {
      let paramBundle = []
      paramBundle.push(leadEvent.payoutInCents);
      paramBundle.push(leadEvent.leadUuid);
      let findClientIDs = leadEvent.clientTagJson.find(obj => obj.key === "client_id");
      paramBundle.push(findClientIDs.value);
      kaoParams.push(paramBundle);
    });
​
// convert list of params into csv format
let csv = kaoParams.map(function(d){
  return d.join();
}).join('\n');
console.log(`Num of entries: ${kaoParams.length}`);
// console.log(csv);
​
// write kaoParams to .csv file
try {
  let csvFile = fs.writeFileSync('csv.csv', csv);
  console.log('kaoParams written to .csv file');
        return;
} catch (err) {
  console.log('File Write Error');
  console.log(err)
}
});
