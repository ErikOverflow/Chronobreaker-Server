const riotApi = require('../util/riotApi');
const axios = require('axios');
const config = require('../config');

const wsconfig = {
    headers: {
        'X-Riot-Token': config.riotApiKey
    }
}

const getAccount = (req,res) => {
    const summonerName = req.query.summonerName;
    const region = req.query.region;
    const url = riotApi.summoner.byName(region, summonerName);
    return axios.get(url, wsconfig).then(result => {
        const account = result.data;
        return res.status(200).json({account});
    })
}

module.exports = {
    getAccount
}