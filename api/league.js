const riotApi = require('../util/riotUrls');
const axios = require('axios');
const config = require('../config');

const wsconfig = {
    headers: {
        'X-Riot-Token': config.riotApiKey
    }
}

//Middleware to add "lol" object to the request and get region of request. Region is require on all requests
const zDrive = (req,res,next) => {
    req.lol = {};
    req.lol.region = req.query.region;
    return next();
}

//Middleware to optionally parse the account and fetch it from Riot on any requests. the Quey Parameter "SummonerName" is on the request, it adds Riot's account details.
const accountParser = (req,_,next) => {
    if(req.query.summonerName && req.lol.region){
        const summonerName = req.query.summonerName;
        const url = riotApi.summoner.byName(req.lol.region, summonerName);
        return axios.get(url, wsconfig).then(result => {
            req.lol.account = result.data;
            return next();
        })
    }
    else{
        return next();
    }
}

const getAccount = (req, res) => {
    return res.status(200).json(req.lol.account);
}

module.exports = {
    zDrive,
    accountParser,
    getAccount,
}