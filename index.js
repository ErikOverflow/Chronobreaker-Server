const express = require('express');
const app = express();
const port = 5000;

const cors = require('cors');
app.use(cors());

const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const riotMongoose = require('./dbs/riotDb');
const riotDb = riotMongoose.connection;
riotDb.on('error', console.error.bind(console, 'Riot MongoDB connection error'));
const league = require('./services/league')(riotDb);
//Middleware for prepping the req.lol object, then pulling region from the payload
app.use(league.zDrive);


var v1 = express.Router();
v1.get("/ping", (req,res) => {
    res.status(200).json({ ping: "Server is running."});
});

v1.get("/account", league.accountParser, league.getAccount);
v1.get("/loadMatches", league.accountParser, league.fetchNewMatches, (req,res) => res.status(200).json({payload:"Done"}));
v1.get("/chronobreak", league.loadTimeline, league.accountParser, league.getPlayerLog);
v1.get("/matchData", league.accountParser, league.getMatchData);
v1.get("/championData", league.getChampionByKey);

app.use("/api/v1", v1);

app.listen(port, () => console.log(`App is now listening on port: ${port}`));