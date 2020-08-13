const riotApi = require("../util/riotUrls");
const axios = require("axios");
const config = require("../config");
const Summoner = require("../models/summoner").Summoner;
const statusCodes = require("../util/statusCodes");

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
  const url = riotApi.summoner.byName(req.lol.region, req.query.summonerName);
  let riotData;
  try {
    riotData = await axios.get(url, wsconfig);
  } catch (err) {
    return res
      .status(statusCodes.DATA_NOT_FOUND)
      .json({ summonerName: "Summoner name not found" });
  }
  if(!accountData){
    //create new summoner if they didn't exist
    accountData = new Summoner({
      ...riotData.data,
      region: req.query.region
    });
  } else{
    accountData.set({
      ...riotData.data,
      lastFetched: Date.now()
    });
  }
  await accountData.save();
  req.lol.account = accountData;
  return next();
};

const getAccount = (req, res) => {
  return res.status(200).json(req.lol.account);
};

module.exports = (db) => {
  riotDb = db;
  return {
    zDrive,
    accountParser,
    getAccount,
  };
};
