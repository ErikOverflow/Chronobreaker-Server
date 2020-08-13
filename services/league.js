const riotUrls = require("../util/riotUrls");
const axios = require("axios");
const config = require("../config");
const Summoner = require("../models/summoner").Summoner;
const Match = require("../models/match").Match;
const statusCodes = require("../util/statusCodes");
const match = require("../models/match");

let riotDb;
const wsconfig = {
  headers: {
    "X-Riot-Token": config.riotApiKey,
  },
};

//Middleware to add "lol" object to the request and get region of request. Region is require on all requests
const zDrive = (req, res, next) => {
  req.lol = {};
  req.lol.region = req.query.region;
  return next();
};

//Middleware to optionally parse the account and fetch it from Riot/mongo database on any requests. the Quey Parameter "SummonerName" is on the request, it adds Riot's account details.
const accountParser = async (req, res, next) => {
  if (!req.query.summonerName && !req.lol.region) {
    return res
      .status(statusCodes.BAD_REQUEST)
      .json({ request: "Missing summonerName and region" });
  }
  let accountData;
  try {
    accountData = await Summoner.findOne({
      name: new RegExp(req.query.summonerName, "i"),
      region: new RegExp(req.lol.region, "i"),
    });
  } catch (err) {
    console.error(err.message);
    return res
      .status(statusCodes.SERVICE_UNAVAILABLE)
      .json({ db: "Unable to connect to League Cache DB" });
  }
  //If a document was returned, check its staleness (lastFetched should be within 24 hours)
  if (accountData) {
    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    //If it's not stale, return it
    if (accountData.lastFetched > yesterday) {
      req.lol.account = accountData;
      return next();
    }
  }

  //If we reach this point in the code, we know that the accountData doesn't exist or is stale. We will have to fetch from Riot again
  const url = riotUrls.summoner.byName(req.lol.region, req.query.summonerName);
  let riotResponse;
  try {
    riotResponse = await axios.get(url, wsconfig);
  } catch (err) {
    return res
      .status(statusCodes.DATA_NOT_FOUND)
      .json({ summonerName: "Summoner name not found" });
  }
  if (!accountData) {
    //create new summoner if they didn't exist
    accountData = new Summoner({
      ...riotResponse.data,
      region: req.query.region,
    });
  } else {
    accountData.set({
      ...riotResponse.data,
      lastFetched: Date.now(),
    });
  }
  await accountData.save();
  req.lol.account = accountData;
  return next();
};

const getAccount = (req, res) => {
  return res.status(200).json(req.lol.account);
};

const loadNewMatches = async (req, res, next) => {
  //Account and region should already be on req.lol.account and req.lol.region

  //Get the time of the last stored match for the current player

  //Get match list for player since the last call (beginTime)
  const url = riotUrls.match.list(
    req.lol.region,
    req.lol.account.accountId,
    (beginTime = 1596941563121)
  );
  let riotResponse;
  try {
    riotResponse = await axios.get(url, wsconfig);
  } catch (err) {
    return res
      .status(statusCodes.DATA_NOT_FOUND)
      .json({ riot: "Match list not found" });
  }

  for (const match of riotResponse.data.matches) {
    //remove any matches that are already stored in the database
    let cachedMatch;
    try {
      cachedMatch = await Match.findOne({
        gameId: match.gameId,
      });
    } catch (err) {
      console.error(err.message);
      return res
        .status(statusCodes.SERVICE_UNAVAILABLE)
        .json({ db: "Unable to connect to Match Cache DB" });
    }
    if(cachedMatch){
      //Don't fetch details, the match is already stored
      continue;
    }
    let matchDetailsResponse;
    const detailUrl = riotUrls.match.details(match.platformId, match.gameId);
    try {
      matchDetailsResponse = await axios.get(detailUrl, wsconfig);
    } catch (err) {
      return res
        .status(statusCodes.DATA_NOT_FOUND)
        .json({ riot: "Match details not found" });
    }
    let matchData = matchDetailsResponse.data;

    //Parse out teams separately
    let teams = [];
    matchData.teams.forEach((team) => {
      teams.push({
        ...team,
      });
    });
    delete matchData.teams;

    //Parse our participants separately
    let participants = [];
    matchData.participants.forEach((participant) => {
      let identity = matchData.participantIdentities.find(
        (identity) => identity.participantId == participant.participantId
      );
      let participantDoc = {
        ...participant,
        ...identity.player,
      };
      participants.push(participantDoc);
    });
    delete matchData.participants;

    //Create the match object
    matchDoc = new Match({
      ...matchData,
      teams,
      participants,
    });
    await matchDoc.save();
  }
  return next();
};

module.exports = (db) => {
  riotDb = db;
  return {
    zDrive,
    accountParser,
    getAccount,
    loadNewMatches,
  };
};
