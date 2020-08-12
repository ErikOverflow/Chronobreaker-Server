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

//Middleware to optionally parse the account and fetch it from Riot on any requests. the Quey Parameter "SummonerName" is on the request, it adds Riot's account details.
const accountParser = (req, res, next) => {
  const summonerName = req.query.summonerName;
  if (req.query.summonerName && req.lol.region) {
    Summoner.findOne(
      { name: summonerName, region: req.lol.region },
      (err, doc) => {
        if (err) {
          return res
            .status(statusCodes.SERVICE_UNAVAILABLE)
            .json({ db: "Unable to connect to League Cache DB" });
        } else {
          if (!doc) {
            const url = riotApi.summoner.byName(req.lol.region, summonerName);
            return axios.get(url, wsconfig).then((result) => {
              req.lol.account = {
                ...result.data,
                region: req.lol.region,
              };
              let accountData = new Summoner(req.lol.account);
              accountData.save();
              return next();
            })
            .catch((err) => {
                return res.status(statusCodes.DATA_NOT_FOUND).json({summonerName: "Summoner name not found"});
            });
          } else {
            req.lol.account = doc;
            return next();
          }
        }
      }
    );
  } else {
    return next();
  }
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
