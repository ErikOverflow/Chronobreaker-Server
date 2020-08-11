const riotApi = require('../util/riotUrls');
const axios = require('axios');
const config = require('../config');

const wsconfig = {
    headers: {
        'X-Riot-Token': config.riotApiKey
    }
}

const getAccount = (req, res) => {
    return res.status(200).json(req.account);
}

const parseAccount = (req,res,next) => {
    const summonerName = req.query.summonerName;
    const region = req.query.region;
    const url = riotApi.summoner.byName(region, summonerName);
    return axios.get(url, wsconfig).then(result => {
        req.account = result.data;
        return next();
    })
}

module.exports = {
    getAccount,
    parseAccount
}