const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SummonerSchema = new Schema({
    id: {type: String, required: true},
    accountId: {type: String, required: true},
    puuid: String,
    name: {type: String, required: true},
    profileIconId: Number,
    revisionDate: Number,
    summonerLevel: Number,
    region: String,
    lastFetched: {type: Date, default: Date.now()}
});
const Summoner = mongoose.model('Summoner', SummonerSchema);

module.exports = {
    SummonerSchema,
    Summoner
}