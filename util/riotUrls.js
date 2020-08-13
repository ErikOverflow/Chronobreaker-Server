const summoner = {
    byName: (region, name) => `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${name}`,
}
const match = {
    list: (region, accountId, beginTime) => `https://${region}.api.riotgames.com/lol/match/v4/matchlists/by-account/${accountId}?beginTime=${beginTime}`,
    details: (region, matchId) => `https://${region}.api.riotgames.com/lol/match/v4/matches/${matchId}`,
    timeline: (region, matchId) => `https://${region}.api.riotgames.com/lol/match/v4/timelines/by-match/${matchId}`
}

module.exports = {
    match,
    summoner
}