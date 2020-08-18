const riotUrls = require("../util/riotUrls");
const axios = require("axios");
const config = require("../config");
const Summoner = require("../models/summoner").Summoner;
const Match = require("../models/match").Match;
const Timeline = require("../models/timeline").Timeline;
const champion = require('./champion');
const statusCodes = require("../util/statusCodes");
const ignoredEvents = ["WARD_PLACED",
"WARD_KILL",
"ITEM_PURCHASED",
"ITEM_SOLD",
"ITEM_DESTROYED",
"ITEM_UNDO",
"SKILL_LEVEL_UP",
"ASCENDED_EVENT",
"CAPTURE_POINT",
"PORO_KING_SUMMON"]

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
    yesterday.setDate(yesterday.getDate() - 7);
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

const fetchNewMatches = async (req, res, next) => {
  //Account and region should already be on req.lol.account and req.lol.region

  //Get the time of the last stored match for the current player
  let beginTime;
  try {
    const lastMatch = await Match.findOne({
      "participants.accountId": req.lol.account.accountId,
    }).sort({ gameCreation: -1 });
    beginTime = lastMatch.gameCreation;
  } catch (err) {
    beginTime = 0;
  }

  //Get match list for player since the last stored match (beginTime)
  const url = riotUrls.match.list(
    req.lol.region,
    req.lol.account.accountId,
    beginTime+1
  );
  let riotResponse;
  try {
    riotResponse = await axios.get(url, wsconfig);
  } catch (err) {
    if(err.response.status === statusCodes.DATA_NOT_FOUND){
      return res
      .status(statusCodes.DATA_NOT_FOUND)
      .json({ matches: "No new matches" });
    }
    return res
      .status(statusCodes.SERVICE_UNAVAILABLE)
      .json({ riot: "Error fetching data from Riot" });
  }
  //Iterate through the matches and store the details
  let promises = riotResponse.data.matches.map((match) => {
    return fetchMatchDetails(match);
  });
  await Promise.all(promises);
  return next();
};

const fetchMatchDetails = async (match) => {
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
  if (cachedMatch) {
    //Don't fetch details, the match is already stored.
    return Promise.resolve("OK");
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
  let matchDoc = new Match({
    ...matchData,
    teams,
    participants,
  });
  await matchDoc.save();
  return Promise.resolve("OK");
};

const loadTimeline = async (req,res,next) => {
  const region = req.lol.region;
  if (!req.query.gameId) {
    return res
      .status(statusCodes.BAD_REQUEST)
      .json({ request: "Missing game ID" });
  }
  const gameId = req.query.gameId;
  await fetchMatchTimeline(region, gameId);
  return next();
}

const fetchMatchTimeline = async (region, gameId) => {
  let cachedTimeline;
  try {
    cachedTimeline = await Timeline.findOne({
      gameId,
    });
  } catch (err) {
    console.error(err.message);
    return res
      .status(statusCodes.SERVICE_UNAVAILABLE)
      .json({ db: "Unable to connect to Timeline Cache DB" });
  }
  if (cachedTimeline) {
    //Don't fetch details, the Timeline is already stored.
    return Promise.resolve("OK");
  }

  let timelineResponse;
  const timelineUrl = riotUrls.match.timeline(region, gameId);
  try {
    timelineResponse = await axios.get(timelineUrl, wsconfig);
  } catch (err) {
    return Promise.reject("Failed to fetch data from Riot");
  }
  let timelineData = timelineResponse.data;
  let frames = [];
  timelineData.frames.forEach(riotFrame => {
    let frame = {
      participantFrames: Object.values(riotFrame.participantFrames),
      events: riotFrame.events,
      timestamp: riotFrame.timestamp,
    }
    frames.push(frame);
  });

  let timelineDoc = new Timeline({
    gameId,
    frameInterval: timelineData.frameInterval,
    frames,
  })
  await timelineDoc.save();
  return Promise.resolve(timelineDoc);
}

const getPlayerLog = async (req, res) => {
  if (!req.query.gameId) {
    return res
      .status(statusCodes.BAD_REQUEST)
      .json({ request: "Missing game ID" });
  }
  const accountId = req.lol.account.accountId;
  const region = req.lol.region;
  const gameId = req.query.gameId;
  let match;
  try {
    match = await Match.findOne({
      gameId,
    });
  } catch (err) {
    console.error(err.message);
    return res
      .status(statusCodes.SERVICE_UNAVAILABLE)
      .json({ db: "Unable to connect to Match Cache DB" });
  }
  let timeline;
  try {
    timeline = await Timeline.findOne({
      gameId,
    });
  } catch (err) {
    console.error(err.message);
    return res
      .status(statusCodes.SERVICE_UNAVAILABLE)
      .json({ db: "Unable to connect to Timeline Cache DB" });
  }
  const participant = match.participants.find(participant => participant.accountId === accountId);
  let playerStatLog = [];
  let events = [];
  timeline.frames.forEach(frame => {
    participantFrame = frame.participantFrames.filter(pFrame => {
      return pFrame.participantId === participant.participantId}
      );
    playerStatLog.push({
      timestamp: frame.timestamp,
      playerStats: participantFrame,
    });
    frame.events.forEach(event => {
      if(!ignoredEvents.includes(event.type)){
        events.push(event);
      }
    })
  })

  return res.status(200).json({statLog: playerStatLog, events});
}

const getMatchData = async (req,res) => {
  if (!req.query.gameId) {
    return res
      .status(statusCodes.BAD_REQUEST)
      .json({ request: "Missing game ID" });
  }
  const accountId = req.lol.account.accountId;
  const region = req.lol.region;
  const gameId = req.query.gameId;
  let match;
  try {
    match = (await Match.findOne({
      gameId,
    })).toObject();
  } catch (err) {
    console.error(err.message);
    return res
      .status(statusCodes.SERVICE_UNAVAILABLE)
      .json({ db: "Unable to connect to Match Cache DB" });
  }

  for (let participant of match.participants){
    let champ = await champion.getChampionByKey(participant.championId);
    participant.championName = champ.name;
  }

  // for (index in match.participants){
  //   let participant = match.participants[index];
  //   match.participants[index].championName = await champion.getChampionByKey(participant.championId);
  // }
  return res.status(200).json(match);
}

const getChampionByKey = async (req,res) => {
  if(!req.query.championKey){
      return res.status(statusCodes.BAD_REQUEST).json({request: "Champion ID must be specified in the request."});
  }
  const championData = await champion.getChampionByKey(req.query.championKey);
  return res.status(statusCodes.OK).json(championData);
}

module.exports = (db) => {
  riotDb = db;
  return {
    zDrive,
    accountParser,
    getAccount,
    fetchNewMatches,
    loadTimeline,
    getPlayerLog,
    getMatchData,
    getChampionByKey
  };
};
