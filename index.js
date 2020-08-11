const express = require('express');
const app = express();
const port = 5000;

const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const league = require('./api/league');

//Middleware for 
app.use(league.zDrive);
app.use(league.accountParser);

var v1 = express.Router();
v1.get("/ping", (req,res) => {
    res.status(200).json({ ping: "Server is running."});
});

v1.get("/account", league.getAccount);

app.use("/api/v1", v1);

app.listen(port, () => console.log(`App is now listening on port: ${port}`));