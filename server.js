("use strict"); 
const express = require("express"); // import the express package
const server = express(); // creates the server
const request = require("request");

const bearerToken =
  "40aa1d92-1d7c-4c1c-8754-b02cf577a721_c16829a5-34d3-430e-80e8-0f3a8d4cf8ea";

// handle requests to the root of the api, the / route
server.get("/", (req, res) => {
  res.send("Hello from Express");
});

request.get("https://api.github.com/users/trailynne");

server.get("/kao-data",  (req, res) => {
  request(
    {
      url: "https://swapi.dev/api/people/1",
      json: {},
    },

    function (error, response, body) {
      console.error("error:", error); // Print the error if one occurred
      console.log("statusCode:", response && response.statusCode); // Print the response status code if a response was received
      console.log("body:", body); // Print the HTML or JSON for the page.
      res.status(200).json(body);
    }
  );
});

// watch for connections on port 4000
https: server.listen(4000, () =>
  console.log("Server running on http://localhost:4000")
);
